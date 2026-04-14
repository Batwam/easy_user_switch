import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gdm from 'gi://Gdm';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

let indicator = null;
const EasyUserSwitch = GObject.registerClass(
	{ GTypeName: 'EasyUserSwitch' },
class EasyUserSwitch extends PanelMenu.Button {
	_init(settings, extension){
		super._init(0.0,'EasyUserSwitch',false);
		this.settings = settings;
		this._extension = extension;

		this.box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		this.add_child(this.box);

		let icon = new St.Icon({
			icon_name: 'system-users-symbolic',
			style_class: 'system-status-icon'
		});
		this.box.add_child(icon);

		this.menu.connect('open-state-changed', (_menu, open) => {
			if (open)
				this._updateMenu();
		}); //generate menu on open

		this._updateMenu(); //populate menu before first open
	}

	_updateMenu() {
		const DEBUG_MODE = this.settings.get_boolean('debug-mode');

		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js: '+'_updateMenu()');

		this.menu.removeAll();

		this.menu.addAction(_('Settings'), () => this._extension.openPreferences());
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		let sessionStatus = this._runShell('loginctl session-status');
		this._activeSession = sessionStatus.substring(0,sessionStatus.indexOf(' '));//keep number before fors space
		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctlInfo - Active session: '+JSON.stringify(this._activeSession));

		this._switch_user_item = new PopupMenu.PopupMenuItem(_("Login Screen"));
		this._switch_user_item.connect('activate', () => {
			if (this.settings.get_boolean ('lock-screen-on-switch')){
				this._lockActiveScreen();
				setTimeout(() => {//allow 500ms to lock before switching
					Gdm.goto_login_session_sync(null)
				}, 500);
			}
			else
				Gdm.goto_login_session_sync(null)
		});
		this.menu.addMenuItem(this._switch_user_item);

		// identify current user
		let activeUser = GLib.get_user_name().toString();

		//extract loginctl info
		let loginctl = JSON.parse(this._runShell('loginctl list-sessions --json=short'));
		loginctl = loginctl.filter( element => element.seat === "seat0" && element.class === "user" && element.tty); //only keep switchable graphical users
		let loginctlInfo = [];
		loginctl.forEach((element) => { //keep one switchable session per user
			if (element.user !== activeUser && element.user !== 'gdm'){
				loginctlInfo = loginctlInfo.filter((item) => item.user !== element.user);
				loginctlInfo.push(element);
			}
		});
		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctlInfo: '+JSON.stringify(loginctlInfo));

		//identify tty for each user
		if(Object.keys(loginctlInfo).length > 0){
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			loginctlInfo.forEach((item) => {
				const username = item.user;
				if (DEBUG_MODE)
					console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - identifying tty for: '+username);

				if (DEBUG_MODE)
					console.log(Date().substring(16,24)+' panel-user-switch/src/extension.js: '+item.user+' connected in '+item.tty+' ('+item.session+')');

				let displayName = item.user;
				if (DEBUG_MODE) //provide tty info in menu
					displayName =  displayName +' ('+item.tty+', session '+item.session+')';

				let menu_item = new PopupMenu.PopupMenuItem(displayName);

				menu_item.connect('activate', () => {
					this.menu.close();
					if (this.settings.get_boolean ('lock-screen-on-switch')){
						this._lockActiveScreen();
						setTimeout(() => { //allow 500ms to lock before switching
							this._switchTTY(item);
						}, 500);
					}
					else
						this._switchTTY(item);
				});
				this.menu.addMenuItem(menu_item);
			});
		}
	}

	_runShell(command){
		//run shell command
		//https://gjs.guide/guides/gio/subprocesses.html#communicating-with-processes
		let loop = GLib.MainLoop.new(null, false);
		let argument = GLib.shell_parse_argv(command)[1];
		let output = false;

		const DEBUG_MODE = this.settings.get_boolean('debug-mode');

		try {
			let subprocess = Gio.Subprocess.new(
				argument,
				Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
			);

			subprocess.communicate_utf8_async(null, null, (proc, res) => {
				try {
					let [, stdout, stderr] = proc.communicate_utf8_finish(res);
					if (proc.get_successful()) {
						output = stdout;
					} else {
						throw new Error(stderr);
					}
				} catch (err) {
					if (DEBUG_MODE)
						console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - _runShell() communicate error: '+err);

				} finally {
					loop.quit();
				}
			});
		} catch (err) {
			if (DEBUG_MODE)
				console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - _runShell() general error: '+err);
		}
		loop.run();
		return output;
	}

	_disable(){
		if(this.icon)
			this.box.remove_child(this.icon);

		if (this.label)
			this.box.remove_child(this.label);

		this.remove_child(this.box);
	}

	_lockActiveScreen(){
		const DEBUG_MODE = this.settings.get_boolean ('debug-mode');
		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js: locking screen');

		Main.overview.hide(); //leave overview mode first if activated
		Main.screenShield.lock(true); //lock screen
	}

	_switchTTY(item){
		const DEBUG_MODE = this.settings.get_boolean ('debug-mode');
		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctl to '+item.user+' (session '+item.session+')');

		this._runShell('loginctl activate '+item.session); //switch to associated tty
	}
});

export default class EasyUserSwitchExtension extends Extension {
	enable(){
		indicator = new EasyUserSwitch(this.getSettings(), this);
		Main.panel.addToStatusArea('easyuserswitch-menu', indicator);//added it so it shows in gdm too
	}

	disable(){
		indicator._disable();
		indicator.destroy();
		indicator = null;
	}
}
