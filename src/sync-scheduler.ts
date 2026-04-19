import { countUnpushedCommits } from "./git-exec";
import { runGitSync } from "./git-sync";

export type SyncRunOptions = { silent: boolean; blocking: boolean };

export class SyncScheduler {
	private syncChain: Promise<void> = Promise.resolve();
	private needsDeferredPush = false;
	private onlineFlushTimer?: number;

	constructor(
		private readonly vaultPath: string,
		private readonly pluginName: string,
		private readonly getCommitTemplate: () => string,
		private readonly notify: (message: string, isSilent?: boolean, duration?: number) => void,
	) {}

	clearOnlineFlushTimer(): void {
		if (this.onlineFlushTimer !== undefined) {
			window.clearTimeout(this.onlineFlushTimer);
			this.onlineFlushTimer = undefined;
		}
	}

	scheduleFlushPending(): void {
		if (this.onlineFlushTimer !== undefined) {
			window.clearTimeout(this.onlineFlushTimer);
		}
		this.onlineFlushTimer = window.setTimeout(() => {
			this.onlineFlushTimer = undefined;
			void this.flushPendingIfOnline();
		}, 400);
	}

	runSync(options: SyncRunOptions): Promise<void> {
		const next = this.syncChain.then(() => this.runSyncAndCapture(options));
		this.syncChain = next.catch(() => undefined);
		return next;
	}

	private async flushPendingIfOnline(): Promise<void> {
		if (typeof navigator !== "undefined" && !navigator.onLine) {
			return;
		}
		const ahead = await countUnpushedCommits(this.vaultPath);
		if (!this.needsDeferredPush && ahead === 0) {
			return;
		}
		await this.runSync({ silent: true, blocking: false });
	}

	private async runSyncAndCapture(options: SyncRunOptions): Promise<void> {
		const r = await runGitSync(
			this.vaultPath,
			this.pluginName,
			{ ...options, commitTemplate: this.getCommitTemplate() },
			this.notify,
		);
		this.needsDeferredPush = r.needsDeferredPush;
	}
}
