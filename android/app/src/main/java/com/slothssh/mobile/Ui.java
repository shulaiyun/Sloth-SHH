package com.slothssh.mobile;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

public final class Ui {
    public static final int DARK_BG = Color.rgb(8, 12, 20);
    public static final int DARK_PANEL = Color.rgb(16, 22, 34);
    public static final int DARK_PANEL_2 = Color.rgb(21, 29, 44);
    public static final int LIGHT_BG = Color.rgb(242, 245, 250);
    public static final int LIGHT_PANEL = Color.WHITE;
    public static final int ACCENT = Color.rgb(124, 140, 255);
    public static final int GREEN = Color.rgb(90, 208, 168);
    public static final int RED = Color.rgb(239, 116, 123);

    private Ui() { }

    public static int dp(Context context, float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    public static int text(Context context) { return UiPreferences.light(context) ? Color.rgb(23, 32, 51) : Color.rgb(232, 236, 245); }
    public static int muted(Context context) { return UiPreferences.light(context) ? Color.rgb(102, 114, 135) : Color.rgb(126, 137, 155); }
    public static int background(Context context) { return UiPreferences.light(context) ? LIGHT_BG : DARK_BG; }
    public static int panel(Context context) { return UiPreferences.light(context) ? LIGHT_PANEL : DARK_PANEL; }

    public static GradientDrawable rounded(int color, float radius, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        if (strokeColor != Color.TRANSPARENT) drawable.setStroke(1, strokeColor);
        return drawable;
    }

    public static TextView label(Context context, String value, float size, int color) {
        TextView text = new TextView(context);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        text.setGravity(Gravity.CENTER_VERTICAL);
        return text;
    }

    public static Button button(Context context, String value, boolean primary) {
        Button button = new Button(context);
        button.setText(value);
        button.setTextSize(13);
        button.setAllCaps(false);
        button.setTextColor(primary ? Color.WHITE : text(context));
        button.setBackground(rounded(primary ? ACCENT : panel(context), dp(context, 10), primary ? Color.TRANSPARENT : Color.argb(35, 124, 140, 255)));
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        button.setPadding(dp(context, 14), 0, dp(context, 14), 0);
        button.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(context, 42)));
        return button;
    }

    public static void margin(View view, int left, int top, int right, int bottom) {
        ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
        params.setMargins(left, top, right, bottom);
        view.setLayoutParams(params);
    }

    public static Typeface monospace() { return Typeface.create("monospace", Typeface.NORMAL); }
}
