package com.slothssh.mobile;

import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.UIKeyboardInteractive;
import com.jcraft.jsch.UserInfo;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.regex.Pattern;

public final class SshSessionManager {
    public interface Listener {
        void onChanged(TerminalSession terminalSession);
        void onHostKeyPrompt(TerminalSession terminalSession, String message, Consumer<Boolean> decision);
    }

    public static final class TerminalSession {
        public final String id = UUID.randomUUID().toString();
        public final Host host;
        public final String label;
        public volatile String state = "connecting";
        public volatile String errorCode = "";
        public volatile String error = "";
        private final StringBuilder buffer = new StringBuilder();
        private volatile Listener listener;
        private volatile Session session;
        private volatile ChannelShell channel;
        private volatile OutputStream output;

        private TerminalSession(Host host, int number) {
            this.host = host;
            this.label = number > 1 ? host.name + " · " + number : host.name;
        }

        public synchronized String output() { return buffer.toString(); }

        private synchronized void append(String value) {
            buffer.append(value);
            if (buffer.length() > 250_000) buffer.delete(0, buffer.length() - 200_000);
        }

        public void setListener(Listener value) { listener = value; }
        public boolean connected() { return "connected".equals(state) && channel != null && channel.isConnected(); }
    }

    private static final SshSessionManager INSTANCE = new SshSessionManager();
    private static final Pattern ANSI_CSI = Pattern.compile("\\u001B\\[[;?0-9]*[ -/]*[@-~]");
    private static final Pattern ANSI_OSC = Pattern.compile("\\u001B\\][^\\u0007]*(?:\\u0007|\\u001B\\\\)");
    private final CopyOnWriteArrayList<TerminalSession> sessions = new CopyOnWriteArrayList<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    private SshSessionManager() { }
    public static SshSessionManager get() { return INSTANCE; }
    public List<TerminalSession> all() { return new ArrayList<>(sessions); }

    public TerminalSession find(String id) {
        for (TerminalSession item : sessions) if (item.id.equals(id)) return item;
        return null;
    }

    public TerminalSession create(Host host, String password, File knownHosts) {
        return create(host, password, knownHosts, null);
    }

    public TerminalSession create(Host host, String password, File knownHosts, Listener listener) {
        int number = 1;
        for (TerminalSession item : sessions) if (item.host.id.equals(host.id)) number++;
        TerminalSession terminalSession = new TerminalSession(host, number);
        terminalSession.setListener(listener);
        sessions.add(terminalSession);
        executor.execute(() -> connect(terminalSession, password, knownHosts));
        return terminalSession;
    }

    public void send(TerminalSession terminalSession, String data) {
        executor.execute(() -> {
            try {
                if (terminalSession.output != null) {
                    terminalSession.output.write(data.getBytes(StandardCharsets.UTF_8));
                    terminalSession.output.flush();
                }
            } catch (Exception error) {
                fail(terminalSession, error);
            }
        });
    }

    public void resize(TerminalSession terminalSession, int columns, int rows, int width, int height) {
        executor.execute(() -> {
            try {
                if (terminalSession.channel != null) terminalSession.channel.setPtySize(columns, rows, width, height);
            } catch (Exception ignored) { }
        });
    }

    public void close(TerminalSession terminalSession) {
        sessions.remove(terminalSession);
        executor.execute(() -> {
            try { if (terminalSession.channel != null) terminalSession.channel.disconnect(); } catch (Exception ignored) { }
            try { if (terminalSession.session != null) terminalSession.session.disconnect(); } catch (Exception ignored) { }
            terminalSession.state = "closed";
            notifyChanged(terminalSession);
        });
    }

    public void clear(TerminalSession terminalSession) {
        synchronized (terminalSession) {
            terminalSession.buffer.setLength(0);
        }
        notifyChanged(terminalSession);
    }

    private void connect(TerminalSession terminalSession, String password, File knownHosts) {
        try {
            if (!knownHosts.exists()) {
                File parent = knownHosts.getParentFile();
                if (parent != null) parent.mkdirs();
                new FileOutputStream(knownHosts, true).close();
            }
            JSch jsch = new JSch();
            jsch.setKnownHosts(knownHosts.getAbsolutePath());
            Session ssh = jsch.getSession(terminalSession.host.username, terminalSession.host.hostname, terminalSession.host.port);
            ssh.setPassword(password);
            ssh.setConfig("StrictHostKeyChecking", "ask");
            ssh.setConfig("PreferredAuthentications", "password,keyboard-interactive");
            ssh.setTimeout(15_000);
            ssh.setUserInfo(new PromptUserInfo(terminalSession, password));
            terminalSession.session = ssh;
            ssh.connect(15_000);

            ChannelShell shell = (ChannelShell) ssh.openChannel("shell");
            shell.setPty(true);
            shell.setPtyType("xterm-256color", 100, 35, 1080, 720);
            InputStream input = shell.getInputStream();
            terminalSession.output = shell.getOutputStream();
            terminalSession.channel = shell;
            shell.connect(12_000);
            terminalSession.state = "connected";
            terminalSession.append("\n● SlothSSH Android terminal ready\n");
            notifyChanged(terminalSession);

            byte[] bytes = new byte[8192];
            int count;
            while (shell.isConnected() && (count = input.read(bytes)) >= 0) {
                String text = new String(bytes, 0, count, StandardCharsets.UTF_8);
                terminalSession.append(clean(text));
                notifyChanged(terminalSession);
            }
            if (!"closed".equals(terminalSession.state)) {
                terminalSession.state = "disconnected";
                notifyChanged(terminalSession);
            }
        } catch (Exception error) {
            fail(terminalSession, error);
        }
    }

    private String clean(String value) {
        String text = ANSI_OSC.matcher(value).replaceAll("");
        text = ANSI_CSI.matcher(text).replaceAll("");
        text = text.replace("\r\n", "\n").replace('\r', '\n').replace("\b", "");
        return text;
    }

    private void fail(TerminalSession terminalSession, Exception error) {
        terminalSession.state = "error";
        String message = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
        String lower = message.toLowerCase(Locale.ROOT);
        terminalSession.errorCode = "other";
        if (lower.contains("auth fail") || lower.contains("authentication")) terminalSession.errorCode = "auth";
        else if (lower.contains("timeout") || lower.contains("timed out")) terminalSession.errorCode = "timeout";
        else if (lower.contains("unknownhost") || lower.contains("unknown host")) terminalSession.errorCode = "dns";
        else if (lower.contains("refused")) terminalSession.errorCode = "refused";
        else if (lower.contains("reject hostkey") || lower.contains("hostkey has been changed")) terminalSession.errorCode = "hostkey";
        terminalSession.error = message;
        notifyChanged(terminalSession);
    }

    private void notifyChanged(TerminalSession terminalSession) {
        Listener listener = terminalSession.listener;
        if (listener != null) listener.onChanged(terminalSession);
    }

    private final class PromptUserInfo implements UserInfo, UIKeyboardInteractive {
        private final TerminalSession terminalSession;
        private final String password;

        private PromptUserInfo(TerminalSession terminalSession, String password) {
            this.terminalSession = terminalSession;
            this.password = password;
        }

        @Override public String getPassphrase() { return null; }
        @Override public String getPassword() { return password; }
        @Override public boolean promptPassword(String message) { return password != null && !password.isEmpty(); }
        @Override public boolean promptPassphrase(String message) { return false; }
        @Override public void showMessage(String message) { terminalSession.append("\n" + message + "\n"); notifyChanged(terminalSession); }

        @Override
        public boolean promptYesNo(String message) {
            Listener listener = terminalSession.listener;
            if (listener == null) return false;
            CountDownLatch latch = new CountDownLatch(1);
            AtomicBoolean accepted = new AtomicBoolean(false);
            listener.onHostKeyPrompt(terminalSession, message, value -> {
                accepted.set(Boolean.TRUE.equals(value));
                latch.countDown();
            });
            try { return latch.await(90, TimeUnit.SECONDS) && accepted.get(); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        }

        @Override
        public String[] promptKeyboardInteractive(String destination, String name, String instruction, String[] prompts, boolean[] echo) {
            String[] answers = new String[prompts.length];
            for (int index = 0; index < prompts.length; index++) answers[index] = password;
            return answers;
        }
    }
}
