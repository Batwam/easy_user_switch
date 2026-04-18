import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gdm from 'gi://Gdm';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

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
				this._updateMenu().catch(err => this._logCommandError('Failed to update menu', err));
		}); //generate menu on open

		this._updateMenu().catch(err => this._logCommandError('Failed to initialize menu', err)); //populate menu before first open
	}

	async _updateMenu() {
		const DEBUG_MODE = this.settings.get_boolean('debug-mode');

		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js: '+'_updateMenu()');

		this.menu.removeAll();

		this.menu.addAction(_('Settings'), () => this._extension.openPreferences());
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		let sessionStatus = await this._runCommand(['loginctl', 'session-status']);
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
		let loginctl = JSON.parse(await this._runCommand(['loginctl', 'list-sessions', '--json=short']));
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
							this._switchTTY(item).catch(err => this._logCommandError('Failed to activate session', err));
						}, 500);
					}
					else
						this._switchTTY(item).catch(err => this._logCommandError('Failed to activate session', err));
				});
				this.menu.addMenuItem(menu_item);
			});
		}
	}

	async _runCommand(argv, cancellable = null){
		let cancelId = 0;
		const flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;
		const subprocess = new Gio.Subprocess({argv, flags});

		subprocess.init(cancellable);

		if (cancellable instanceof Gio.Cancellable)
			cancelId = cancellable.connect(() => subprocess.force_exit());

		try {
			const [stdout, stderr] = await subprocess.communicate_utf8_async(null, null);
			const status = subprocess.get_exit_status();

			if (status !== 0) {
				throw new Gio.IOErrorEnum({
					code: Gio.IOErrorEnum.FAILED,
					message: stderr ? stderr.trim() : `Command '${argv}' failed with exit code ${status}`,
				});
			}

			return stdout.trim();
		} finally {
			if (cancelId > 0)
				cancellable.disconnect(cancelId);
		}
	}

	_logCommandError(context, err){
		console.error(`easy-user-switch: ${context}`, err);
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

	async _switchTTY(item){
		const DEBUG_MODE = this.settings.get_boolean ('debug-mode');
		if (DEBUG_MODE)
			console.log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctl to '+item.user+' (session '+item.session+')');

		await this._runCommand(['loginctl', 'activate', item.session]); //switch to associated tty
	}
});

export default class EasyUserSwitchExtension extends Extension {
	enable(){
		indicator = new EasyUserSwitch(this.getSettings(), this);
		Main.panel.addToStatusArea('easyuserswitch-menu', indicator);//added it so it shows in gdm too
	}

	disable(){
		// Session-mode changes tear down the visible indicator here, but
		// lock-before-switch intentionally leaves a delayed handoff in flight.
		// That flow locks the current session first, then completes the switch to
		// GDM or another user from a 500ms timeout, so the extension still needs to
		// run in unlock-dialog even though its panel UI is removed during disable().
		indicator._disable();
		indicator.destroy();
		indicator = null;
	}
}
