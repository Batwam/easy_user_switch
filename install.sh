#!/bin/bash

cd "$(dirname "$0")/src"
# automatically generate name from metadata info
extension=$(cat metadata.json | grep uuid | awk '{print $2}' | tr -d '",')
LOCAL_DIR="$HOME/.local/share/gnome-shell/extensions/$extension"
SYSTEM_DIR="/usr/share/gnome-shell/extensions/$extension"

while getopts 's:-system:c:-compile:d:-debug:h:-help:' flag; do
    case "${flag}" in
        s | --system)
			system_install=true;;
        c | --compile)
			compile_schema=true;;
		d | --debug)
			debug_mode=true;;
		h | --help)
			echo "Usage"
			echo -e "\t ./auto_install.sh [options]\n"
			echo -e "META OPTIONS"
			echo -e "-h,--help\t display this help menu"
			echo -e ""
			echo -e "OPTIONS"
			echo -e "--system\t install system wide (run as root)"
			echo -e "-c,--compile\t to recompile the extension schema (requires glib-compile-schemas)"
			echo -e "-d,--debug\t debug mode"
			exit 0;
    esac
done

#option for system wide install
INSTALL_DIR="$LOCAL_DIR"
if [ "$system_install" == true ]; then
	if [ "$EUID" -ne 0 ]; then
		echo "Please run as root"
		exit
	fi
	echo "installing the extension system wide..."
	INSTALL_DIR=$SYSTEM_DIR
fi

#option to recompile the schema
if [ "$compile_schema" == true ]; then
	echo "compiling git schema..."
	glib-compile-schemas schemas/
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

printf "\e[32mCopying extension files to target directory:\n\e[0m"
cp -Rv ./* $INSTALL_DIR

#go back to original folder
cd $OLDPWD

if [ "$debug_mode" == true ]; then
	if hash ccze; then
		journalctl --follow -o cat /usr/bin/gnome-shell GNOME_SHELL_EXTENSION_UUID=$extension | ccze
	else
		journalctl --follow -o cat /usr/bin/gnome-shell GNOME_SHELL_EXTENSION_UUID=$extension
	fi
fi

#exit if run as root
if [ "$EUID" -eq 0 ]; then
	exit
fi

#enable extension
gnome-extensions enable $extension

if [ "$XDG_SESSION_TYPE" = "x11" ]; then
	printf "\n\e[32mAll files copied. \nReloading the gnome-shell (shortcut Alt + F2, r) to load the extension.\n\n\e[0m"
	#killall -3 gnome-shell
	
	gnome-extensions enable $extension
else
	printf "\n\e[32mAll files copied. \nPlease log out and log back in again to load the extension.\n\n\e[0m"
fi
