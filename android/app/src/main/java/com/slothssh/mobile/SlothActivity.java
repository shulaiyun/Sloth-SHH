package com.slothssh.mobile;

import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;

public abstract class SlothActivity extends Activity {
    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(UiPreferences.localized(base));
    }

    @Override
    protected void onCreate(Bundle state) {
        setTheme(UiPreferences.light(this) ? R.style.Theme_SlothSSH_Light : R.style.Theme_SlothSSH_Dark);
        super.onCreate(state);
        getWindow().setStatusBarColor(Ui.background(this));
        getWindow().setNavigationBarColor(Ui.background(this));
        int flags = getWindow().getDecorView().getSystemUiVisibility();
        if (UiPreferences.light(this)) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        else flags &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    @Override
    public void setContentView(View view) {
        final int left = view.getPaddingLeft();
        final int top = view.getPaddingTop();
        final int right = view.getPaddingRight();
        final int bottom = view.getPaddingBottom();
        view.setOnApplyWindowInsetsListener((target, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                target.setPadding(left + bars.left, top + bars.top, right + bars.right, bottom + bars.bottom);
            } else {
                target.setPadding(left + insets.getSystemWindowInsetLeft(), top + insets.getSystemWindowInsetTop(),
                        right + insets.getSystemWindowInsetRight(), bottom + insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        super.setContentView(view);
    }
}
