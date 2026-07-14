package com.slothssh.mobile;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.util.List;
import java.util.function.Consumer;

public final class TerminalActivity extends SlothActivity implements SshSessionManager.Listener {
    private final SshSessionManager manager = SshSessionManager.get();
    private HostRepository repository;
    private Host host;
    private SshSessionManager.TerminalSession active;
    private LinearLayout tabs;
    private TextView title;
    private TextView status;
    private TextView output;
    private ScrollView outputScroll;
    private EditText command;
    private Button disconnect;
    private final Runnable renderTask = this::renderActive;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        repository = new HostRepository(this);
        host = repository.find(getIntent().getStringExtra("hostId"));
        if (host == null) {
            finish();
            return;
        }
        setContentView(buildScreen());
        attachOrCreate(false);
    }

    private View buildScreen() {
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(Ui.background(this));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 10), Ui.dp(this, 8));
        page.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 66)));

        Button back = Ui.button(this, "‹", false);
        back.setTextSize(26);
        back.setOnClickListener(view -> finish());
        header.addView(back, new LinearLayout.LayoutParams(Ui.dp(this, 46), Ui.dp(this, 44)));

        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.VERTICAL);
        heading.setPadding(Ui.dp(this, 8), 0, Ui.dp(this, 6), 0);
        header.addView(heading, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        title = Ui.label(this, host.name, 17, Ui.text(this));
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        heading.addView(title);
        status = Ui.label(this, getString(R.string.connecting), 11, Ui.muted(this));
        heading.addView(status);

        Button add = Ui.button(this, "+", false);
        add.setTextSize(20);
        add.setContentDescription(getString(R.string.new_session));
        add.setOnClickListener(view -> attachOrCreate(true));
        header.addView(add, new LinearLayout.LayoutParams(Ui.dp(this, 44), Ui.dp(this, 42)));
        disconnect = Ui.button(this, getString(R.string.disconnect), false);
        disconnect.setTextColor(Ui.RED);
        disconnect.setOnClickListener(view -> closeActive());
        header.addView(disconnect);

        HorizontalScrollView tabScroll = new HorizontalScrollView(this);
        tabScroll.setHorizontalScrollBarEnabled(false);
        tabs = new LinearLayout(this);
        tabs.setGravity(Gravity.CENTER_VERTICAL);
        tabs.setPadding(Ui.dp(this, 8), Ui.dp(this, 5), Ui.dp(this, 8), Ui.dp(this, 5));
        tabScroll.addView(tabs, new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
        page.addView(tabScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 52)));

        outputScroll = new ScrollView(this);
        outputScroll.setFillViewport(true);
        outputScroll.setBackgroundColor(Color.rgb(5, 8, 14));
        output = new TextView(this);
        output.setTextColor(Color.rgb(218, 225, 239));
        output.setTextSize(13.5f);
        output.setTypeface(Ui.monospace());
        output.setTextIsSelectable(true);
        output.setGravity(Gravity.TOP | Gravity.START);
        output.setPadding(Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 24));
        outputScroll.addView(output, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        page.addView(outputScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        HorizontalScrollView keyScroll = new HorizontalScrollView(this);
        keyScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout keys = new LinearLayout(this);
        keys.setPadding(Ui.dp(this, 7), Ui.dp(this, 7), Ui.dp(this, 7), Ui.dp(this, 7));
        keys.setGravity(Gravity.CENTER_VERTICAL);
        keyScroll.addView(keys);
        addKey(keys, "Ctrl+C", "\u0003");
        addKey(keys, "Tab", "\t");
        addKey(keys, "Esc", "\u001b");
        addKey(keys, "↑", "\u001b[A");
        addKey(keys, "↓", "\u001b[B");
        addKey(keys, "←", "\u001b[D");
        addKey(keys, "→", "\u001b[C");
        Button paste = keyButton(getString(R.string.paste));
        paste.setOnClickListener(view -> pasteClipboard());
        keys.addView(paste);
        Button clear = keyButton(getString(R.string.clear));
        clear.setOnClickListener(view -> { if (active != null) manager.clear(active); });
        keys.addView(clear);
        page.addView(keyScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 56)));

        LinearLayout composer = new LinearLayout(this);
        composer.setGravity(Gravity.CENTER_VERTICAL);
        composer.setPadding(Ui.dp(this, 9), Ui.dp(this, 5), Ui.dp(this, 9), Ui.dp(this, 10));
        command = new EditText(this);
        command.setSingleLine(true);
        command.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        command.setImeOptions(EditorInfo.IME_ACTION_SEND);
        command.setHint(R.string.command_hint);
        command.setTextColor(Ui.text(this));
        command.setHintTextColor(Ui.muted(this));
        command.setTypeface(Ui.monospace());
        command.setBackground(Ui.rounded(Ui.panel(this), Ui.dp(this, 11), Color.argb(42, 124, 140, 255)));
        command.setPadding(Ui.dp(this, 13), 0, Ui.dp(this, 13), 0);
        command.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND || (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
                sendCommand();
                return true;
            }
            return false;
        });
        composer.addView(command, new LinearLayout.LayoutParams(0, Ui.dp(this, 48), 1));
        Button send = Ui.button(this, getString(R.string.send), true);
        send.setOnClickListener(view -> sendCommand());
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(this, 48));
        sendParams.setMargins(Ui.dp(this, 8), 0, 0, 0);
        composer.addView(send, sendParams);
        page.addView(composer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 66)));
        return page;
    }

    private Button keyButton(String text) {
        Button button = Ui.button(this, text, false);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(this, 40));
        params.setMargins(Ui.dp(this, 3), 0, Ui.dp(this, 3), 0);
        button.setLayoutParams(params);
        return button;
    }

    private void addKey(LinearLayout keys, String label, String data) {
        Button button = keyButton(label);
        button.setOnClickListener(view -> sendRaw(data));
        keys.addView(button);
    }

    private void attachOrCreate(boolean forceNew) {
        if (!forceNew) {
            List<SshSessionManager.TerminalSession> sessions = manager.all();
            for (int index = sessions.size() - 1; index >= 0; index--) {
                SshSessionManager.TerminalSession session = sessions.get(index);
                if (session.host.id.equals(host.id) && !"closed".equals(session.state)) {
                    select(session);
                    return;
                }
            }
        }
        File knownHosts = new File(getFilesDir(), "ssh/known_hosts");
        select(manager.create(host, repository.password(host), knownHosts, this));
    }

    private void select(SshSessionManager.TerminalSession session) {
        if (active != null && active != session) active.setListener(null);
        active = session;
        active.setListener(this);
        renderTabs();
        renderActive();
    }

    private void renderTabs() {
        tabs.removeAllViews();
        for (SshSessionManager.TerminalSession session : manager.all()) {
            Button tab = keyButton(stateDot(session) + " " + session.label);
            boolean selected = session == active;
            tab.setTextColor(selected ? Color.WHITE : Ui.muted(this));
            if (selected) tab.setBackground(Ui.rounded(Ui.ACCENT, Ui.dp(this, 9), Color.TRANSPARENT));
            tab.setOnClickListener(view -> select(session));
            tabs.addView(tab);
        }
    }

    private String stateDot(SshSessionManager.TerminalSession session) {
        if (session.connected()) return "●";
        if ("error".equals(session.state)) return "!";
        if ("connecting".equals(session.state)) return "◌";
        return "○";
    }

    private void renderActive() {
        if (active == null) return;
        String text = active.output();
        if ("error".equals(active.state)) text += errorExplanation(active);
        if (!text.contentEquals(output.getText())) {
            output.setText(text);
            outputScroll.post(() -> outputScroll.fullScroll(View.FOCUS_DOWN));
        }
        title.setText(active.label);
        status.setText(statusText(active));
        status.setTextColor("error".equals(active.state) ? Ui.RED : active.connected() ? Ui.GREEN : Ui.muted(this));
        command.setEnabled(active.connected());
        disconnect.setEnabled(!"closed".equals(active.state));
        renderTabs();
    }

    private String statusText(SshSessionManager.TerminalSession session) {
        if (session.connected()) return getString(R.string.connected) + " · " + session.host.username + "@" + session.host.hostname;
        if ("connecting".equals(session.state)) return getString(R.string.connecting) + " " + session.host.hostname + ":" + session.host.port;
        if ("error".equals(session.state)) return getString(R.string.connection_failed);
        return getString(R.string.disconnected);
    }

    private String errorExplanation(SshSessionManager.TerminalSession session) {
        int message;
        switch (session.errorCode) {
            case "auth": message = R.string.error_auth; break;
            case "timeout": message = R.string.error_timeout; break;
            case "dns": message = R.string.error_dns; break;
            case "refused": message = R.string.error_refused; break;
            case "hostkey": message = R.string.error_hostkey; break;
            default: message = R.string.error_other;
        }
        return "\n\n[SlothSSH] " + getString(message) + "\n" + getString(R.string.technical_details) + ": " + session.error + "\n";
    }

    private void sendCommand() {
        String value = command.getText().toString();
        if (value.isEmpty() || active == null || !active.connected()) return;
        manager.send(active, value + "\n");
        command.setText("");
    }

    private void sendRaw(String value) {
        if (active != null && active.connected()) manager.send(active, value);
    }

    private void pasteClipboard() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard.hasPrimaryClip() && clipboard.getPrimaryClip() != null && clipboard.getPrimaryClip().getItemCount() > 0) {
            CharSequence value = clipboard.getPrimaryClip().getItemAt(0).coerceToText(this);
            command.getText().insert(command.getSelectionStart(), value);
        }
    }

    private void closeActive() {
        if (active == null) return;
        SshSessionManager.TerminalSession closing = active;
        manager.close(closing);
        List<SshSessionManager.TerminalSession> remaining = manager.all();
        if (remaining.isEmpty()) {
            finish();
        } else {
            select(remaining.get(remaining.size() - 1));
        }
    }

    @Override
    public void onChanged(SshSessionManager.TerminalSession session) {
        if (session != active) return;
        runOnUiThread(() -> {
            output.removeCallbacks(renderTask);
            output.postDelayed(renderTask, 45);
        });
    }

    @Override
    public void onHostKeyPrompt(SshSessionManager.TerminalSession session, String message, Consumer<Boolean> decision) {
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle(R.string.host_key_title)
                .setMessage(getString(R.string.host_key_message) + "\n\n" + message)
                .setCancelable(false)
                .setNegativeButton(R.string.cancel, (dialog, which) -> decision.accept(false))
                .setPositiveButton(R.string.trust, (dialog, which) -> decision.accept(true))
                .show());
    }

    @Override
    protected void onDestroy() {
        output.removeCallbacks(renderTask);
        if (active != null) active.setListener(null);
        super.onDestroy();
    }
}
