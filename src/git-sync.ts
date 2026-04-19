import { countAheadOfUpstream, createExecute, runGitCommit } from "./git-exec";
import { isBrowserOnline, isLikelyNetworkError } from "./network";

export interface RunSyncOptions {
	silent: boolean;
	blocking: boolean;
	commitTemplate: string;
}

export interface GitSyncResult {
	/** Есть локальные коммиты без push — нужно повторить после появления сети. */
	needsDeferredPush: boolean;
}

type Execute = (cmd: string) => Promise<string>;
type NotifyFn = (message: string, isSilent?: boolean, duration?: number) => void;

function expandCommitTemplate(template: string, filesChanged: number): string {
	const now = new Date();
	return template
		.replace(/\{date\}/g, now.toLocaleDateString())
		.replace(/\{time\}/g, now.toLocaleTimeString())
		.replace(/\{files\}/g, String(filesChanged));
}

function notifyOffline(notify: NotifyFn, silent: boolean, didCommit: boolean, ahead: number): void {
	const important = !silent || didCommit || ahead > 0;
	if (!important) {
		return;
	}
	if (didCommit) {
		notify("🌐 Нет сети. Изменения сохранены локально.", false, 8000);
	} else if (ahead > 0) {
		notify("🌐 Нет сети. Есть неотправленные коммиты; отправка после восстановления сети.", false, 8000);
	} else {
		notify("🌐 Нет сети. Синхронизация отложена.", false, 6000);
	}
}

async function stageAndCommitIfNeeded(
	execute: Execute,
	blocking: boolean,
	vaultPath: string,
	commitTemplate: string,
): Promise<{ filesChanged: number; didCommit: boolean }> {
	await execute("git add .");
	const status = await execute("git status --porcelain");
	const filesChanged = status.trim().split("\n").filter(Boolean).length;
	if (filesChanged === 0) {
		return { filesChanged: 0, didCommit: false };
	}
	const template = commitTemplate.trim() || "Auto-sync {date} {time}";
	const commitMessage = expandCommitTemplate(template, filesChanged);
	await runGitCommit(blocking, vaultPath, commitMessage);
	return { filesChanged, didCommit: true };
}

async function finishOfflineSync(
	execute: Execute,
	notify: NotifyFn,
	silent: boolean,
	didCommit: boolean,
): Promise<GitSyncResult> {
	const ahead = await countAheadOfUpstream(execute);
	notifyOffline(notify, silent, didCommit, ahead);
	return { needsDeferredPush: didCommit || ahead > 0 };
}

async function runOfflineLocalSave(
	execute: Execute,
	blocking: boolean,
	vaultPath: string,
	commitTemplate: string,
	notify: NotifyFn,
	silent: boolean,
): Promise<GitSyncResult> {
	const { didCommit } = await stageAndCommitIfNeeded(execute, blocking, vaultPath, commitTemplate);
	return finishOfflineSync(execute, notify, silent, didCommit);
}

async function tryGitPull(
	execute: Execute,
	recoverOffline: () => Promise<GitSyncResult>,
): Promise<{ ok: true; pullOut: string } | { ok: false; result: GitSyncResult }> {
	try {
		const pullOut = await execute("git pull");
		return { ok: true, pullOut };
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (!isLikelyNetworkError(msg)) {
			throw e;
		}
		return { ok: false, result: await recoverOffline() };
	}
}

type PushOutcome =
	| { kind: "pushed"; summaryPart: string }
	| { kind: "offline"; result: GitSyncResult };

async function tryGitPush(
	execute: Execute,
	filesChanged: number,
	recoverOffline: (didCommit: boolean) => Promise<GitSyncResult>,
): Promise<PushOutcome> {
	try {
		await execute("git push");
		const summaryPart = filesChanged > 0 ? "Изменения отправлены. " : "Коммиты отправлены. ";
		return { kind: "pushed", summaryPart };
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (isLikelyNetworkError(msg)) {
			return { kind: "offline", result: await recoverOffline(filesChanged > 0) };
		}
		throw e;
	}
}

/** Heuristic: git often prints English even under localized UI; match common variants. */
function pullIndicatesUpdates(pullOut: string): boolean {
	const t = pullOut.trim();
	if (!t) {
		return false;
	}
	const lower = t.toLowerCase();
	if (lower.includes("already up to date") || lower.includes("already up-to-date")) {
		return false;
	}
	if (lower.includes("current branch is up to date")) {
		return false;
	}
	// Russian locale (some Git builds)
	if (lower.includes("уже актуально") || lower.includes("уже обновлено")) {
		return false;
	}
	return true;
}

async function runOnlineSyncAfterPull(
	execute: Execute,
	blocking: boolean,
	vaultPath: string,
	commitTemplate: string,
	notify: NotifyFn,
	silent: boolean,
	pluginName: string,
	pullOut: string,
	startTime: number,
): Promise<GitSyncResult> {
	const pulledUpdates = pullIndicatesUpdates(pullOut);
	const { filesChanged } = await stageAndCommitIfNeeded(execute, blocking, vaultPath, commitTemplate);
	const aheadAfter = await countAheadOfUpstream(execute);

	let summary = "";
	if (pulledUpdates) {
		summary += "Получены обновления. ";
	}

	const shouldPush = filesChanged > 0 || aheadAfter > 0;
	const recoverOffline = (didCommit: boolean) => finishOfflineSync(execute, notify, silent, didCommit);

	if (shouldPush) {
		const pushOutcome = await tryGitPush(execute, filesChanged, recoverOffline);
		if (pushOutcome.kind === "offline") {
			return pushOutcome.result;
		}
		summary += pushOutcome.summaryPart;
	} else {
		summary += "Нет изменений. ";
	}

	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	notify(
		`✅ ${pluginName}: ${summary}Синхронизировано за ${duration} с. Изменено файлов: ${filesChanged}`,
		silent,
	);
	return { needsDeferredPush: false };
}

async function handleSyncFailure(
	execute: Execute,
	pluginName: string,
	notify: NotifyFn,
	startTime: number,
	e: unknown,
): Promise<GitSyncResult> {
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const msg = e instanceof Error ? e.message : String(e);
	notify(`❌ ${pluginName} Ошибка (${duration} с): ${msg}`, false, 0);
	const ahead = await countAheadOfUpstream(execute).catch(() => 0);
	return { needsDeferredPush: ahead > 0 };
}

export async function runGitSync(
	vaultPath: string,
	pluginName: string,
	options: RunSyncOptions,
	notify: NotifyFn,
): Promise<GitSyncResult> {
	const { silent, blocking, commitTemplate } = options;
	notify(`${pluginName}: Синхронизация...`, silent);

	const execute = createExecute(blocking, vaultPath);
	const startTime = Date.now();

	try {
		if (!isBrowserOnline()) {
			return runOfflineLocalSave(execute, blocking, vaultPath, commitTemplate, notify, silent);
		}

		const pull = await tryGitPull(execute, () =>
			runOfflineLocalSave(execute, blocking, vaultPath, commitTemplate, notify, silent),
		);
		if (!pull.ok) {
			return pull.result;
		}

		return await runOnlineSyncAfterPull(
			execute,
			blocking,
			vaultPath,
			commitTemplate,
			notify,
			silent,
			pluginName,
			pull.pullOut,
			startTime,
		);
	} catch (e: unknown) {
		return handleSyncFailure(execute, pluginName, notify, startTime, e);
	}
}
