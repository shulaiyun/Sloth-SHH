package com.slothssh.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class HostRepository {
    private static final String PREFS = "slothssh.hosts";
    private static final String KEY = "records";
    private final SharedPreferences preferences;
    private final SecureStore secureStore = new SecureStore();

    public HostRepository(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized List<Host> all() {
        List<Host> hosts = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(preferences.getString(KEY, "[]"));
            for (int index = 0; index < array.length(); index++) hosts.add(Host.fromJson(array.getJSONObject(index)));
        } catch (Exception ignored) { }
        hosts.sort(Comparator.comparing((Host host) -> !host.favorite).thenComparing(host -> host.name.toLowerCase(Locale.ROOT)));
        return hosts;
    }

    public synchronized Host find(String id) {
        for (Host host : all()) if (host.id.equals(id)) return host;
        return null;
    }

    public synchronized void save(Host host, String password) {
        List<Host> hosts = all();
        if (password != null && !password.isEmpty()) host.encryptedPassword = secureStore.encrypt(password);
        boolean updated = false;
        for (int index = 0; index < hosts.size(); index++) {
            if (hosts.get(index).id.equals(host.id)) {
                hosts.set(index, host);
                updated = true;
                break;
            }
        }
        if (!updated) hosts.add(host);
        write(hosts);
    }

    public synchronized void delete(String id) {
        List<Host> hosts = all();
        hosts.removeIf(host -> host.id.equals(id));
        write(hosts);
    }

    public String password(Host host) {
        return secureStore.decrypt(host.encryptedPassword);
    }

    private void write(List<Host> hosts) {
        JSONArray array = new JSONArray();
        for (Host host : hosts) {
            try { array.put(host.toJson()); } catch (Exception ignored) { }
        }
        preferences.edit().putString(KEY, array.toString()).apply();
    }
}
