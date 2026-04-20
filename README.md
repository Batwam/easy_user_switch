# Gnome Panel User Switch
Gnome-shell extension to easily switch between **connected** users using an icon on the panel which lists the users currently logged in. It is similar to using Ctrl+Alt+Fn but the extension will identify and list the associated Virtual terminal for each user and provides the ability to do it directly from the gnome panel.

Note that is a user is not logged in, its name will not appear. You can then use the "Login Screen" option to go to the login screen and log this user in.

This is loosely inspired by the now discontinued https://github.com/HROMANO/fastuserswitch in terms of functionality but switches Virtual Terminals by activating the target session through `loginctl`.

# Install
1. To install the extension locally (ie ~/.local/share/gnome-shell/extensions/): `./install.sh`
2. Restart gnome-shell, using <kbd>Alt</kbd>+<kbd>F2</kbd> then `r`+<kbd>Enter</kbd> with Xorg or logout/login with Wayland.
3. Enable the extension through your extensions manager or by running `gnome-extensions enable easyuserswitch@batwam.corp`

# Alternative Install
- Enable an extension for all users (system-wide)
run `sudo ./install.sh --system`

# Testing and Develipment
- Open the logs directly for testing purposes (recommended to use Debug Mode on in the Preferences):
run `./install.sh --debug` or run directly `journalctl --follow -o cat /usr/bin/gnome-shell GNOME_SHELL_EXTENSION_UUID="easyuserswitch@batwam.corp"`
- To recompile the schemas (regenerates gscemas.compiled if the xml file is being modifiled)
run `./install.sh --compile`

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
Recommended system settings can be set in the Settings panel for the extension accessible through right/left click on the icon or your extension manager. This includes:
- An option is included to Enable/Disable the screen lock due to inactivity. This is a built-in gnome option which is only included in the Preferences for convenience.
- An option to lock the session when switching. If disabled, the user can easily switch between sessions, however, this also means that the second user can switch back to the first user's session as it will not be locked. Consider your own privacy/security objectives when activating this.
- An option to turn on DEBUG mode this will add debug information in the console (see above regarding `--debug` option)
