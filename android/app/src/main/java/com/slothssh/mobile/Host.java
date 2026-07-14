package com.slothssh.mobile;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

public final class Host {
    public String id = UUID.randomUUID().toString();
    public String name = "";
    public String hostname = "";
    public int port = 22;
    public String username = "root";
    public String encryptedPassword = "";
    public String notes = "";
    public boolean favorite = false;

    public JSONObject toJson() throws JSONException {
        return new JSONObject()
                .put("id", id)
                .put("name", name)
                .put("hostname", hostname)
                .put("port", port)
                .put("username", username)
                .put("encryptedPassword", encryptedPassword)
                .put("notes", notes)
                .put("favorite", favorite);
    }

    public static Host fromJson(JSONObject json) {
        Host host = new Host();
        host.id = json.optString("id", host.id);
        host.name = json.optString("name");
        host.hostname = json.optString("hostname");
        host.port = json.optInt("port", 22);
        host.username = json.optString("username", "root");
        host.encryptedPassword = json.optString("encryptedPassword");
        host.notes = json.optString("notes");
        host.favorite = json.optBoolean("favorite", false);
        return host;
    }
}
