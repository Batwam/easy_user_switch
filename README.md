# Gnome Panel User Switch
Gnome-shell extension to easily switch between **connected** users using an icon on the panel which lists the users currently logged in. It is similar to using Ctrl+Alt+Fn but the extension will identify the appropriate Virtual terminal for each user and provides the ability to do it directly from the gnome panel.

Note that is a user is not logged in, its name will not appear. You can then use the "Login Screen" option to go to the login screen and log this user in.

This is loosely inspired by https://github.com/HROMANO/fastuserswitch in terms of functionality but uses an alternative method by simulating Ctrl+Alt+Fx to switch Virtual Terminal by running the `loginctl` command (or `chvt` as optional alternative).

Alternatively, it can run the `chvt` command but this requires the `chvt` command to be added to the sudoers file (See preferenced to change method). This can be achieved by creating a file in your `etc/sudoers.d` folder and include the list of users who require using `chvt` as follows:
`user1,user2,user3  ALL=(ALL:ALL) NOPASSWD: /usr/bin/chvt`

# Install
1. To install the extension locally (ie ~/.local/share/gnome-shell/extensions/): `./auto_install.sh`
2. Restart gnome-shell, using <kbd>Alt</kbd>+<kbd>F2</kbd> then `r`+<kbd>Enter</kbd> with Xorg or logout/login with Wayland.
3. Enable the extension through your extensions manager or by running `gnome-extensions enable easyuserswitch@batwam.corp`

# Alternative Install
run `./auto_install.sh --help` for a full list of installation options available.

Alternative installation options include:
- Enable an extension for all users (system-wide)
run `sudo ./auto_install.sh --system`
- Show debug messages for testing purposes (requires Debug Mode on in the Preferences)
run `sudo ./auto_install.sh --debug`

# Uninstall Extension
- Disable the extension
`gnome-extensions disable easyuserswitch@batwam.corp`

Delete the installed files either manually or by using the following commands:
- For Local installation:
`rm -rf "$HOME/.local/share/gnome-shell/extensions/easyuserswitch@batwam.corp`
- For System wide installation:
`sudo rm -rf /usr/share/gnome-shell/extensions/easyuserswitch@batwam.corp`

Restart gnome-shell, using <kbd>Alt</kbd>+<kbd>F2</kbd> then `r`+<kbd>Enter</kbd> with Xorg or logout/login with Wayland.
## Extras
Recommended system settings can be set in the Settings panel for the extension accessible through right click on the icon
- An option is included to Enable/Disable the screen lock due to inactivity. This is a built-in gnome option which is only included in the Preferences for convenience
- An option to lock the session when switching. If disabled, the user can easily switch between sessions, however, this also means that the second user can switch back to the first user's session as it will not be locked. Consider your own privacy objectives when activating this.
- When Debug Mode is enabled in preferences, you can check the logs by running `journalctl --follow -o cat /usr/bin/gnome-shell GNOME_SHELL_EXTENSION_UUID="easyuserswitch@batwam.corp"`
