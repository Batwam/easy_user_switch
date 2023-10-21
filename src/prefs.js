import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function init() {
}

export default class EasyUserSwitchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window){
        const extensionSettings = this.getSettings();
        const systemSettings = ExtensionPreferences.getSettings('org.gnome.desktop.screensaver');

        // Create a preferences page and group
        let page, group, button;

        page = new Adw.PreferencesPage(); 

        //System Preferences
        group = new Adw.PreferencesGroup({ title: 'System Preferences'});
        // group.set_description('Update relevant System Preferences');
        page.add(group);
        this.addToggle('Automatic Screen Lock',"Disable to prevent session from locking due to inactivity",'lock-enabled',systemSettings,group);

        //Extension Preferences
        group = new Adw.PreferencesGroup({ title: 'Extension Preferences'});
        // group.set_description('Update Extension Preferences');
        page.add(group);
        this.addToggle('Lock session before switching',"Enable to require password when switching back",'lock-screen-on-switch',extensionSettings,group);
        let fieldOptions = {'loginctl':'loginctl','chvt':'chvt'};
        this.addCombo('Switch Method','Default `loginctl`. Using `chvt` requires adding the command to sudoers',fieldOptions,'switch-method',extensionSettings,group);
        this.addToggle('Debug Mode','Enable to generate debug messages in `journalctl -f | grep easy-user-switch`','debug-mode',extensionSettings,group);

        //add empty row to separate Rest Button
        group = new Adw.PreferencesGroup({ title: ' ' });
        page.add(group);

        button = new Gtk.Button({
            label: `Reset Settings to Defaults`,
            visible: true
        });
        button.connect('clicked',() => this.resetSettings());
        group.add(button);

        // Add our page to the window
        window.add(page);
    }
}

function resetSettings(){
    systemSettings.reset('lock-enabled');
    extensionSettings.reset('lock-screen-on-switch');
    extensionSettings.reset('debug-mode');
}

function addEmptyRow(page){
    const group = new Adw.PreferencesGroup();
    group.set_title(' ');
    page.add(group);
}

function addToggle(rowTitle,rowSubtitle,rowSettingName,rowSettingLocation,group){
    let row = new Adw.ActionRow({ title: rowTitle });
    row.subtitle = rowSubtitle;
    group.add(row);

    // Create the switch and bind its value to the key
    let toggle = new Gtk.Switch({
        active: rowSettingLocation.get_boolean (rowSettingName),
        valign: Gtk.Align.CENTER,
    });
    rowSettingLocation.bind(rowSettingName,toggle,'active',Gio.SettingsBindFlags.DEFAULT);

    // Add the switch to the row
    row.add_suffix(toggle);
    row.activatable_widget = toggle;

    return row
}

function addCombo(rowTitle,rowSubtitle,options,settingName,settings,group){
    let row = new Adw.ActionRow({ title: rowTitle });
    row.subtitle = rowSubtitle;

    group.add(row);

    // Create the switch and bind its value to the key
    let combo = new Gtk.ComboBoxText({
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.END,
        visible: true
    });
    for (let option in options){
		combo.append(options[option],option);
	}
	combo.set_active_id(settings.get_string(settingName));

	combo.connect('changed', () => {
		settings.set_string(settingName,combo.get_active_id());
    });

    // Add the switch to the row
    row.add_suffix(combo);
    row.activatable_widget = combo;

    return row
}