/**
 * @name HideVoiceButtons
 * @invite undefined
 * @authorLink undefined
 * @donate undefined
 * @patreon undefined
 * @website https://github.com/asportnoy/HideVoiceButtons
 * @source https://raw.githubusercontent.com/asportnoy/HideVoiceButtons/main/HideVoiceButtons.plugin.js
 */
/*@cc_on
@if (@_jscript)
	
	// Offer to self-install for clueless users that try to run this directly.
	var shell = WScript.CreateObject("WScript.Shell");
	var fs = new ActiveXObject("Scripting.FileSystemObject");
	var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\BetterDiscord\plugins");
	var pathSelf = WScript.ScriptFullName;
	// Put the user at ease by addressing them in the first person
	shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
	if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
		shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
	} else if (!fs.FolderExists(pathPlugins)) {
		shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
	} else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
		fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
		// Show the user where to put plugins in the future
		shell.Exec("explorer " + pathPlugins);
		shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
	}
	WScript.Quit();

@else@*/

module.exports = (() => {
    const config = {"info":{"name":"HideVoiceButtons","authors":[{"name":"asportnoy","discord_id":"489484338514100234"}],"version":"1.0.0","description":"Hide Mute and Deafen buttons when not in a voice channel","github":"https://github.com/asportnoy/HideVoiceButtons","github_raw":"https://raw.githubusercontent.com/asportnoy/HideVoiceButtons/main/HideVoiceButtons.plugin.js"},"changelog":[],"main":"index.js"};

    return !global.ZeresPluginLibrary ? class {
        constructor() {this._config = config;}
        getName() {return config.info.name;}
        getAuthor() {return config.info.authors.map(a => a.name).join(", ");}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Library) => {
    const {
        Patcher,
        Logger,
        Settings,
        WebpackModules,
        DiscordModules,
        DiscordAPI,
    } = Library;

    const Modules = {
        Dispatch: WebpackModules.getByProps("dispatch", "subscribe"),
        VoiceStates: WebpackModules.getByProps("getVoiceStates")
    }

    const SEL_PANEL = ".panels-j1Uci_";
    const SEL_BUTTONS = ".button-14-BFJ";

    const PANEL = document.querySelector(SEL_PANEL);
    const buttons = [...PANEL.querySelectorAll(SEL_BUTTONS)].map(x => ({
        action: x.ariaLabel.replace(/ /g, '_'),
        el: x
    }));

    return class HideVoiceButtons extends Plugin {
        constructor() {
            super();

            this.defaultSettings = {};
            this.defaultSettings.buttons = {};
            this.defaultSettings.buttons.Mute = true;
            this.defaultSettings.buttons.Deafen = true;
            this.defaultSettings.buttons.User_Settings = false;

            this.callback = this.stateChange.bind(this);
            this.inChannel = null;

            this.stopped = false;
        }

        isInChannel() { // Boolean for if user is in a voice channel
            return Modules.VoiceStates.isCurrentClientInVoiceChannel();
        }

        toggleButtons() { // Update the buttons with the stored state
            if (this.stopped) return;
            const state = this.inChannel; // Get stored state
            const display = state ? '' : 'none'; // Turn state into display style value

            buttons.forEach((btn) => {
                // If button is enabled in settings, apply the state. Otherwise reset.
                btn.el.style.display = this.settings.buttons[btn.action] ? display : '';
            });
        }

        stateChange(e) { // Handles voice state change effect
            if (this.stopped) return;
            const currentUser = DiscordAPI.currentUser.id; // Logged in user's ID

            // User of event
            const {
                userId
            } = e;

            if (currentUser !== userId) return; // Only apply to user's events

            // Get current voice channel state
            const state = this.isInChannel();

            // Check if the state changed
            if (this.inChannel == state) return;

            // Store new state
            this.inChannel = state;

            // Apply button styles
            this.toggleButtons();
        }

        onStart() {
            // Get voice state update events
            Modules.Dispatch.subscribe("VOICE_STATE_UPDATE", this.callback);

            // Run with current state
            this.inChannel = this.isInChannel();
            this.toggleButtons();

            // Detect changes on buttons and re-apply the styles
            // This fixes other plugins overwriting the styles
            const observer = new MutationObserver(() => {
                if (this.stopped) return observer.disconnect();
                this.toggleButtons();
            });

            observer.observe(PANEL, {
                subtree: true,
                childList: true,
                attributes: true
            });
        }

        onStop() {
            // Remove the event listener
            Modules.Dispatch.unsubscribe("VOICE_STATE_UPDATE", this.callback);

            this.stopped = true;
        }

        getSettingsPanel() {
            return Settings.SettingPanel.build(() => {
                    this.saveSettings(this);
                    this.toggleButtons();
                },
                new Settings.SettingGroup("Buttons", {
                    shown: true
                }).append(
                    new Settings.Switch("Hide Mute Button", null, this.settings.buttons.Mute, (e) => {
                        this.settings.buttons.Mute = e;
                        this.toggleButtons();
                    }),
                    new Settings.Switch("Hide Deafen Button", null, this.settings.buttons.Deafen, (e) => {
                        this.settings.buttons.Deafen = e;
                        this.toggleButtons();
                    }),
                    new Settings.Switch("Hide Settings Button", null, this.settings.buttons.User_Settings, (e) => {
                        this.settings.buttons.User_Settings = e;
                        this.toggleButtons();
                    })
                )
            )
        }
    };
};
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/