import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, PcEzSyncSettingTab, PLUGIN_NAME, PcEzSyncSettings } from "./settings";
import { runGitSync } from "./sync";

export default class PcEzSyncPlugin extends Plugin {
	settings!: PcEzSyncSettings;
	private intervalId?: number;

	async onload(): Promise<void> {
		await this.loadSettings();

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice("PC ez Sync requires a local folder vault.");
			return;
		}
		const vaultPath = adapter.getBasePath();

		this.addRibbonIcon("sync", PLUGIN_NAME, () => {
			void this.runSync(vaultPath, { silent: false, blocking: false });
		});

		this.addSettingTab(new PcEzSyncSettingTab(this.app, this));

		void this.runSync(vaultPath, { silent: false, blocking: false });

		this.setupInterval();

		this.registerEvent(
			this.app.workspace.on("quit", () => {
				void this.runSync(vaultPath, { silent: true, blocking: true });
			}),
		);
	}

	setupInterval(): void {
		if (this.intervalId !== undefined) {
			window.clearInterval(this.intervalId);
			this.intervalId = undefined;
		}

		if (this.settings.syncInterval <= 0) {
			return;
		}

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			return;
		}
		const vaultPath = adapter.getBasePath();
		const ms = this.settings.syncInterval * 60 * 1000;
		this.intervalId = window.setInterval(() => {
			void this.runSync(vaultPath, { silent: true, blocking: false });
		}, ms);
		this.registerInterval(this.intervalId);
	}

	runSync(path: string, options: { silent: boolean; blocking: boolean }): Promise<void> {
		return runGitSync(path, PLUGIN_NAME, options, (message, isSilent, duration) =>
			this.notify(message, isSilent, duration),
		);
	}

	notify(message: string, isSilent = false, duration = 5000): void {
		const now = new Date().toLocaleTimeString();
		console.log(`[${now}] ${PLUGIN_NAME}: ${message}`);

		if (!isSilent) {
			new Notice(message, duration);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<PcEzSyncSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
