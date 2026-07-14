package com.slothssh.mobile;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.PopupMenu;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class MainActivity extends SlothActivity {
    private HostRepository repository;
    private HostAdapter adapter;
    private final List<Host> visibleHosts = new ArrayList<>();
    private String query = "";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        repository = new HostRepository(this);
        setContentView(buildScreen());
        reload();
    }

    @Override protected void onResume() { super.onResume(); if (adapter != null) reload(); }

    private View buildScreen() {
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Ui.background(this));

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        frame.addView(page, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(Ui.dp(this, 18), Ui.dp(this, 10), Ui.dp(this, 10), Ui.dp(this, 10));
        page.addView(header, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.dp(this, 76)));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.slothssh_logo);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        header.addView(logo, new LinearLayout.LayoutParams(Ui.dp(this, 56), Ui.dp(this, 56)));

        LinearLayout titleBox = new LinearLayout(this);
        titleBox.setOrientation(LinearLayout.VERTICAL);
        titleBox.setPadding(Ui.dp(this, 10), 0, 0, 0);
        header.addView(titleBox, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView title = Ui.label(this, "SlothSSH", 20, Ui.text(this));
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        titleBox.addView(title);
        titleBox.addView(Ui.label(this, getString(R.string.all_hosts), 12, Ui.muted(this)));

        Button language = Ui.button(this, "zh".equals(UiPreferences.language(this)) ? "🇨🇳" : "🇺🇸", false);
        language.setContentDescription(getString(R.string.language));
        language.setOnClickListener(view -> {
            UiPreferences.setLanguage(this, "zh".equals(UiPreferences.language(this)) ? "en" : "zh");
            recreate();
        });
        header.addView(language, new LinearLayout.LayoutParams(Ui.dp(this, 50), Ui.dp(this, 44)));

        Button theme = Ui.button(this, UiPreferences.light(this) ? "☀" : "☾", false);
        theme.setContentDescription(getString(R.string.theme));
        theme.setOnClickListener(view -> { UiPreferences.setLight(this, !UiPreferences.light(this)); recreate(); });
        header.addView(theme, new LinearLayout.LayoutParams(Ui.dp(this, 50), Ui.dp(this, 44)));

        EditText search = new EditText(this);
        search.setSingleLine(true);
        search.setHint(R.string.search_hosts);
        search.setTextColor(Ui.text(this));
        search.setHintTextColor(Ui.muted(this));
        search.setBackground(Ui.rounded(Ui.panel(this), Ui.dp(this, 12), Color.argb(35, 124, 140, 255)));
        search.setPadding(Ui.dp(this, 15), 0, Ui.dp(this, 15), 0);
        LinearLayout.LayoutParams searchParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.dp(this, 48));
        searchParams.setMargins(Ui.dp(this, 16), 0, Ui.dp(this, 16), Ui.dp(this, 12));
        page.addView(search, searchParams);
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence text, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence text, int start, int before, int count) { query = text.toString(); reload(); }
            @Override public void afterTextChanged(Editable editable) { }
        });

        FrameLayout listArea = new FrameLayout(this);
        ListView list = new ListView(this);
        list.setDivider(null);
        list.setSelector(android.R.color.transparent);
        list.setPadding(Ui.dp(this, 10), 0, Ui.dp(this, 10), Ui.dp(this, 92));
        list.setClipToPadding(false);
        adapter = new HostAdapter();
        list.setAdapter(adapter);
        listArea.addView(list, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        TextView empty = Ui.label(this, getString(R.string.no_hosts), 14, Ui.muted(this));
        empty.setGravity(Gravity.CENTER);
        empty.setPadding(Ui.dp(this, 36), 0, Ui.dp(this, 36), Ui.dp(this, 70));
        listArea.addView(empty, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        list.setEmptyView(empty);
        page.addView(listArea, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        TextView security = Ui.label(this, "🔐  " + getString(R.string.secure_note), 11, Ui.muted(this));
        security.setPadding(Ui.dp(this, 18), 0, Ui.dp(this, 100), 0);
        page.addView(security, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.dp(this, 54)));

        Button add = Ui.button(this, "+  " + getString(R.string.add_host), true);
        add.setOnClickListener(view -> editHost(null));
        FrameLayout.LayoutParams addParams = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, Ui.dp(this, 50), Gravity.END | Gravity.BOTTOM);
        addParams.setMargins(0, 0, Ui.dp(this, 16), Ui.dp(this, 16));
        frame.addView(add, addParams);
        return frame;
    }

    private void reload() {
        visibleHosts.clear();
        String needle = query.trim().toLowerCase(Locale.ROOT);
        for (Host host : repository.all()) {
            if (needle.isEmpty() || (host.name + " " + host.hostname + " " + host.notes).toLowerCase(Locale.ROOT).contains(needle)) visibleHosts.add(host);
        }
        if (adapter != null) adapter.notifyDataSetChanged();
    }

    private void openTerminal(Host host) {
        Intent intent = new Intent(this, TerminalActivity.class);
        intent.putExtra("hostId", host.id);
        startActivity(intent);
    }

    private void showHostMenu(View anchor, Host host) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(getString(R.string.connect));
        menu.getMenu().add(getString(R.string.edit));
        menu.getMenu().add(host.favorite ? getString(R.string.remove_favorite) : getString(R.string.favorite));
        menu.getMenu().add(getString(R.string.copy_command));
        menu.getMenu().add(getString(R.string.delete));
        menu.setOnMenuItemClickListener(item -> {
            String title = item.getTitle().toString();
            if (title.equals(getString(R.string.connect))) openTerminal(host);
            else if (title.equals(getString(R.string.edit))) editHost(host);
            else if (title.equals(getString(R.string.favorite)) || title.equals(getString(R.string.remove_favorite))) { host.favorite = !host.favorite; repository.save(host, ""); reload(); }
            else if (title.equals(getString(R.string.copy_command))) {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("SSH", "ssh -p " + host.port + " " + host.username + "@" + host.hostname));
                Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show();
            } else if (title.equals(getString(R.string.delete))) confirmDelete(host);
            return true;
        });
        menu.show();
    }

    private void confirmDelete(Host host) {
        new AlertDialog.Builder(this)
                .setTitle(host.name)
                .setMessage(R.string.confirm_delete)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.delete, (dialog, which) -> { repository.delete(host.id); reload(); })
                .show();
    }

    private EditText field(String hint, int inputType) {
        EditText field = new EditText(this);
        field.setHint(hint);
        field.setSingleLine(true);
        field.setInputType(inputType);
        field.setTextColor(Ui.text(this));
        field.setHintTextColor(Ui.muted(this));
        field.setBackground(Ui.rounded(UiPreferences.light(this) ? Color.rgb(247, 249, 252) : Ui.DARK_BG, Ui.dp(this, 9), Color.argb(35, 124, 140, 255)));
        field.setPadding(Ui.dp(this, 12), 0, Ui.dp(this, 12), 0);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.dp(this, 48));
        params.setMargins(0, 0, 0, Ui.dp(this, 10));
        field.setLayoutParams(params);
        return field;
    }

    private void editHost(Host existing) {
        Host host = existing == null ? new Host() : existing;
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(Ui.dp(this, 20), Ui.dp(this, 8), Ui.dp(this, 20), Ui.dp(this, 8));
        EditText name = field(getString(R.string.server_name), InputType.TYPE_CLASS_TEXT);
        EditText hostname = field(getString(R.string.hostname), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        EditText port = field(getString(R.string.port), InputType.TYPE_CLASS_NUMBER);
        EditText username = field(getString(R.string.username), InputType.TYPE_CLASS_TEXT);
        EditText password = field(getString(R.string.password), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        EditText notes = field(getString(R.string.notes), InputType.TYPE_CLASS_TEXT);
        password.setText(existing == null ? "" : repository.password(existing));
        CheckBox show = new CheckBox(this);
        show.setText(R.string.show_password);
        show.setTextColor(Ui.muted(this));
        show.setOnCheckedChangeListener((button, checked) -> {
            password.setInputType(InputType.TYPE_CLASS_TEXT | (checked ? InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD : InputType.TYPE_TEXT_VARIATION_PASSWORD));
            password.setSelection(password.length());
        });
        name.setText(host.name);
        hostname.setText(host.hostname);
        port.setText(String.valueOf(host.port));
        username.setText(host.username);
        notes.setText(host.notes);
        form.addView(name); form.addView(hostname); form.addView(port); form.addView(username); form.addView(password); form.addView(show); form.addView(notes);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(form);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(existing == null ? R.string.add_host : R.string.edit_host)
                .setView(scroll)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.save, null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            if (hostname.getText().toString().trim().isEmpty() || username.getText().toString().trim().isEmpty() || password.getText().toString().isEmpty()) {
                Toast.makeText(this, R.string.required_fields, Toast.LENGTH_SHORT).show();
                return;
            }
            host.name = name.getText().toString().trim().isEmpty() ? hostname.getText().toString().trim() : name.getText().toString().trim();
            host.hostname = hostname.getText().toString().trim();
            try { host.port = Integer.parseInt(port.getText().toString()); } catch (Exception error) { host.port = 22; }
            host.username = username.getText().toString().trim();
            host.notes = notes.getText().toString().trim();
            repository.save(host, password.getText().toString());
            reload();
            dialog.dismiss();
        }));
        dialog.show();
    }

    private final class HostAdapter extends BaseAdapter {
        @Override public int getCount() { return visibleHosts.size(); }
        @Override public Object getItem(int position) { return visibleHosts.get(position); }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            Host host = visibleHosts.get(position);
            LinearLayout card = new LinearLayout(MainActivity.this);
            card.setGravity(Gravity.CENTER_VERTICAL);
            card.setPadding(Ui.dp(MainActivity.this, 14), Ui.dp(MainActivity.this, 9), Ui.dp(MainActivity.this, 12), Ui.dp(MainActivity.this, 9));
            card.setBackground(Ui.rounded(Ui.panel(MainActivity.this), Ui.dp(MainActivity.this, 13), Color.argb(32, 124, 140, 255)));
            LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.dp(MainActivity.this, 74));
            cardParams.setMargins(Ui.dp(MainActivity.this, 4), Ui.dp(MainActivity.this, 4), Ui.dp(MainActivity.this, 4), Ui.dp(MainActivity.this, 5));
            card.setLayoutParams(cardParams);

            TextView icon = Ui.label(MainActivity.this, "▣", 27, Ui.ACCENT);
            icon.setGravity(Gravity.CENTER);
            icon.setBackground(Ui.rounded(Color.argb(24, 124, 140, 255), Ui.dp(MainActivity.this, 10), Color.argb(55, 124, 140, 255)));
            card.addView(icon, new LinearLayout.LayoutParams(Ui.dp(MainActivity.this, 46), Ui.dp(MainActivity.this, 46)));

            LinearLayout copy = new LinearLayout(MainActivity.this);
            copy.setOrientation(LinearLayout.VERTICAL);
            copy.setPadding(Ui.dp(MainActivity.this, 12), 0, 0, 0);
            card.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            TextView hostName = Ui.label(MainActivity.this, (host.favorite ? "★  " : "") + host.name, 16, Ui.text(MainActivity.this));
            hostName.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            copy.addView(hostName);
            TextView address = Ui.label(MainActivity.this, host.username + "@" + host.hostname + ":" + host.port, 11, Ui.muted(MainActivity.this));
            address.setTypeface(Ui.monospace());
            copy.addView(address);
            if (!host.notes.isEmpty()) copy.addView(Ui.label(MainActivity.this, host.notes, 10, Ui.muted(MainActivity.this)));

            TextView action = Ui.label(MainActivity.this, "›", 28, Ui.ACCENT);
            card.addView(action, new LinearLayout.LayoutParams(Ui.dp(MainActivity.this, 30), LinearLayout.LayoutParams.MATCH_PARENT));
            card.setOnClickListener(view -> openTerminal(host));
            card.setOnLongClickListener(view -> { showHostMenu(view, host); return true; });
            return card;
        }
    }
}
