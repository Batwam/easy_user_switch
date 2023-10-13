'use strict';

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {Gio,GLib,GObject,St,Gdm,AccountsService} = imports.gi;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const extensionSettings = ExtensionUtils.getSettings();

let indicator = null;

function enable(){
	indicator = new EasyUserSwitch();
	Main.panel.addToStatusArea('easyuserswitch-menu', indicator);//added it so it shows in gdm too
}

function disable(){
	indicator._disable();
	indicator.destroy();
	indicator = null;
}

var EasyUserSwitch = GObject.registerClass(
	{ GTypeName: 'EasyUserSwitch' },
class EasyUserSwitch extends PanelMenu.Button {
	_init(){
		super._init(0.0,'EasyUserSwitch',false);

		this.box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		this.add_child(this.box);
		
		let icon = new St.Icon({ 
			icon_name: 'system-users-symbolic',
			style_class: 'system-status-icon' 
		});
		this.box.add_child(icon);

		this.connect('button-press-event',(_a, event) => this._updateMenu()); //generate menu on click

		Main.panel.addToStatusArea('EasyUserSwitch',this,0,'right'); //position,panel_side
	}

	_updateMenu() {
		const DEBUG_MODE = extensionSettings.get_boolean('debug-mode');

		if (DEBUG_MODE)
			log(Date().substring(16,24)+' easy-user-switch/src/extension.js: '+'_updateMenu()');

		this.menu.removeAll();

		this.menu.addAction(_('Settings'), () => ExtensionUtils.openPrefs());
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		let sessionStatus = this._runShell('loginctl session-status');
		this._activeSession = sessionStatus.substring(0,sessionStatus.indexOf(' '));//keep number before fors space
		if (DEBUG_MODE)
			log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctlInfo - Active session: '+JSON.stringify(this._activeSession));

		this._switch_user_item = new PopupMenu.PopupMenuItem(_("Login Screen"));
		this._switch_user_item.connect('activate', () => {
			if (extensionSettings.get_boolean ('lock-screen-on-switch')){
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

		//get list of logged in users
		const userManager = AccountsService.UserManager.get_default();
		let usersList = userManager.list_users();
		usersList = usersList.filter( element => element.get_user_name() !== activeUser && element.is_logged_in());
		if (DEBUG_MODE)
			usersList.forEach((element) => {log(Date().substring(16,24)+' easy-user-switch/src/extension.js - user logged in: '+element.get_user_name());});

		//extract loginctl info
		let loginctl = JSON.parse(this._runShell('loginctl list-sessions -o json'));
		loginctl = loginctl.filter( element => element.seat == "seat0"); //only keep graphical users (exclude pihole, ...)
		let loginctlInfo = loginctl.filter( element => element.user !== activeUser && element.user !== 'gdm'); //list of connected users exlucing current user
		if (DEBUG_MODE)
			log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctlInfo: '+JSON.stringify(loginctlInfo));

		//identify tty for each user
		if(Object.keys(usersList).length > 0){
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			usersList.forEach((activeUser) => {
				const username = activeUser.get_user_name();
				if (DEBUG_MODE)
					log(Date().substring(16,24)+' easy-user-switch/src/extension.js - identifying tty for: '+username);

				let item = [];
				// item = loginctlInfo.findLast((element) => element.user == username); //doesnt' seem to work
				loginctlInfo.forEach((element) => { //will pick the last match in case of user listed multiple times
					if (element.user == username){
						item = element;
					}
				});

				if (DEBUG_MODE)
					log(Date().substring(16,24)+' panel-user-switch/src/extension.js: '+item.user+' connected in '+item.tty+' ('+item.session+')');

				let displayName = this._capitalize(item.user);
				if (DEBUG_MODE) //provide tty info in menu
					displayName =  displayName +' ('+item.tty+', session '+item.session+')';

				let menu_item = new PopupMenu.PopupMenuItem(displayName);

				menu_item.connect('activate', () => {
					this.menu.close();
					if (extensionSettings.get_boolean ('lock-screen-on-switch')){
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
		try {
			let proc = Gio.Subprocess.new(
				argument,
				Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
			);
		
			proc.communicate_utf8_async(null, null, (proc, res) => {
				try {
					let [, stdout, stderr] = proc.communicate_utf8_finish(res);
					if (proc.get_successful()) {
						output = stdout;
					} else {
						throw new Error(stderr);
					}
				} catch (err) {
					if (DEBUG_MODE)
						log(Date().substring(16,24)+' easy-user-switch/src/extension.js - _runShell() communicate error: '+err);

				} finally {
					loop.quit();
				}
			});
		} catch (err) {
			if (DEBUG_MODE)
				log(Date().substring(16,24)+' easy-user-switch/src/extension.js - _runShell() general error: '+err);
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
	_capitalize(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}

	_lockActiveScreen(){
		const DEBUG_MODE = extensionSettings.get_boolean ('debug-mode');
		if (DEBUG_MODE)
			log(Date().substring(16,24)+' easy-user-switch/src/extension.js: locking screen');

		Main.overview.hide(); //leave overview mode first if activated
		Main.screenShield.lock(true); //lock screen
	}

	_switchTTY(item){
		const DEBUG_MODE = extensionSettings.get_boolean ('debug-mode');
		const ttyNumber = item.tty.replace("tty","");//only keep number

		const SWITCH_METHOD = extensionSettings.get_string ('switch-method');
		if (DEBUG_MODE)
			log(Date().substring(16,24)+' easy-user-switch/src/extension.js - SWITCH_METHOD: '+SWITCH_METHOD);

		switch(SWITCH_METHOD){
			case 'chvt':
				if (DEBUG_MODE)
					log(Date().substring(16,24)+' easy-user-switch/src/extension.js - chvt: '+item.tty);

				let output = this._runShell('sudo chvt '+ttyNumber); //switch to associated tty
				
				if (!output){
					if (DEBUG_MODE)
						log(Date().substring(16,24)+' easy-user-switch/src/extension.js: '+'no output, display OSD warning');

					const activeUser = GLib.get_user_name().toString();
					const osdText = 'Please add the following to the /etc/sudoers file:\n'+activeUser+' ALL=(ALL:ALL) NOPASSWD: /usr/bin/chvt*';
					this._showOSD('error-symbolic',osdText);
				}
				break;

			case 'loginctl':
					if (DEBUG_MODE)
						log(Date().substring(16,24)+' easy-user-switch/src/extension.js - loginctl to '+item.user+' (session '+item.session+')');

					this._runShell('loginctl activate '+item.session); //switch to associated tty
					break;
		}
	}

	_showOSD(osdIcon,osdText){
		const icon = Gio.Icon.new_for_string(osdIcon);
		const monitor = global.display.get_current_monitor(); //identify current monitor for OSD
		const OsdWindow = imports.ui.osdWindow;
		const defaultOsdTimeout = OsdWindow.HIDE_TIMEOUT;
		OsdWindow.HIDE_TIMEOUT = Math.clamp(1500,40 * osdText.length,5000); //text length dependant OSD timeout duration to allow time to read
		Main.osdWindowManager.show(monitor, icon, osdText); //display error
		OsdWindow.HIDE_TIMEOUT = defaultOsdTimeout; //reset OSD timeout duration to default
	}
});

