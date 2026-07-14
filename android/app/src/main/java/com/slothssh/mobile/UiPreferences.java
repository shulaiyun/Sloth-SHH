package com.slothssh.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import java.util.Locale;

public final class UiPreferences {
    private static final String PREFS = "slothssh.ui";

    private UiPreferences() { }

    public static boolean light(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("light", false);
    }

    public static void setLight(Context context, boolean value) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("light", value).apply();
    }

    public static String language(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("language", "zh");
    }

    public static void setLanguage(Context context, String language) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("language", language).apply();
    }

    public static Context localized(Context context) {
        Configuration configuration = new Configuration(context.getResources().getConfiguration());
        configuration.setLocale(Locale.forLanguageTag(language(context)));
        return context.createConfigurationContext(configuration);
    }
}
