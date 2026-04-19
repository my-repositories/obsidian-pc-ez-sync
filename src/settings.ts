import { App, PluginSettingTab, Setting } from "obsidian";
import type PcEzSyncPlugin from "./main";

export const PLUGIN_NAME = "PC ez Sync";

export interface PcEzSyncSettings {
	syncInterval: number;
}

export const DEFAULT_SETTINGS: PcEzSyncSettings = {
	syncInterval: 5,
};

export class PcEzSyncSettingTab extends PluginSettingTab {
	plugin: PcEzSyncPlugin;

	constructor(app: App, plugin: PcEzSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: PLUGIN_NAME });

		new Setting(containerEl)
			.setName("Интервал (минуты)")
			.setDesc("0 — отключить фоновую синхронизацию.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.syncInterval.toString())
					.onChange(async (v) => {
						this.plugin.settings.syncInterval = Number(v) || 0;
						await this.plugin.saveSettings();
						this.plugin.setupInterval();
					}),
			);
	}
}
