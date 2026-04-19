import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, PcEzSyncSettingTab, PLUGIN_NAME, PcEzSyncSettings } from "./settings";
import { SyncScheduler } from "./sync-scheduler";

export default class PcEzSyncPlugin extends Plugin {
	settings!: PcEzSyncSettings;
	private intervalId?: number;
	private sync?: SyncScheduler;

	async onload(): Promise<void> {
		await this.loadSettings();

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice("This plugin only works when the vault is a folder on this computer.");
			return;
		}
		const vaultPath = adapter.getBasePath();

		const scheduler = new SyncScheduler(vaultPath, PLUGIN_NAME, () => this.settings.commitTemplate, (m, s, d) =>
			this.notify(m, s, d),
		);
		this.sync = scheduler;

		this.addRibbonIcon("sync", PLUGIN_NAME, () => {
			void scheduler.runSync({ silent: false, blocking: false });
		});

		this.addCommand({
			id: "manual-sync",
			name: "Ручная синхронизация",
			callback: () => {
				void scheduler.runSync({ silent: false, blocking: false });
			},
		});

		this.addSettingTab(new PcEzSyncSettingTab(this.app, this));

		void scheduler.runSync({ silent: false, blocking: false });

		this.setupInterval();

		this.registerDomEvent(window, "online", () => {
			this.sync?.scheduleFlushPending();
		});

		this.register(() => {
			this.sync?.clearOnlineFlushTimer();
		});

		this.registerEvent(
			this.app.workspace.on("quit", () => {
				void this.sync?.runSync({ silent: true, blocking: true });
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
		const ms = this.settings.syncInterval * 60 * 1000;
		this.intervalId = window.setInterval(() => {
			void this.sync?.runSync({ silent: true, blocking: false });
		}, ms);
		this.registerInterval(this.intervalId);
	}

	runSync(path: string, options: { silent: boolean; blocking: boolean }): Promise<void> {
		void path;
		if (!this.sync) {
			return Promise.resolve();
		}
		return this.sync.runSync(options);
	}

	notify(message: string, isSilent = false, duration = 5000): void {
		const now = new Date().toLocaleTimeString();
		console.debug(`[${now}] ${PLUGIN_NAME}: ${message}`);

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
