import { App, PluginSettingTab, Setting } from "obsidian";
import type PcEzSyncPlugin from "./main";

export const PLUGIN_NAME = "PC ez Sync";

export interface PcEzSyncSettings {
	syncInterval: number;
	commitTemplate: string;
}

export const DEFAULT_SETTINGS: PcEzSyncSettings = {
	syncInterval: 5,
	commitTemplate: "Auto-sync {files} files on {date} {time}",
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

		new Setting(containerEl).setName(PLUGIN_NAME).setHeading();

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

		new Setting(containerEl)
			.setName("Шаблон коммита")
			.setDesc("Подстановки: {date}, {time}, {files}.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.commitTemplate)
					.setValue(this.plugin.settings.commitTemplate)
					.onChange(async (v) => {
						this.plugin.settings.commitTemplate = v.trim() || DEFAULT_SETTINGS.commitTemplate;
						await this.plugin.saveSettings();
					}),
			);
	}
}
