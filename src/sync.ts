import { exec, execSync } from "child_process";

export interface RunSyncOptions {
	silent: boolean;
	blocking: boolean;
}

function createExecute(blocking: boolean, cwd: string): (cmd: string) => Promise<string> {
	if (blocking) {
		return (cmd: string) =>
			Promise.resolve().then(() => {
				try {
					return execSync(cmd, { cwd }).toString();
				} catch {
					return "";
				}
			});
	}
	return (cmd: string) =>
		new Promise((resolve, reject) => {
			exec(cmd, { cwd }, (err, stdout) => {
				if (err) reject(err);
				else resolve(stdout ?? "");
			});
		});
}

export async function runGitSync(
	vaultPath: string,
	pluginName: string,
	options: RunSyncOptions,
	notify: (message: string, isSilent?: boolean, duration?: number) => void,
): Promise<void> {
	const { silent, blocking } = options;
	notify(`${pluginName}: Синхронизация...`, silent);

	const execute = createExecute(blocking, vaultPath);

	const startTime = Date.now();

	try {
		const pullOut = await execute("git pull");
		const pulledUpdates = Boolean(pullOut && !pullOut.includes("Already up to date."));

		await execute("git add .");
		const status = await execute("git status --porcelain");
		const filesChanged = status.trim().split("\n").filter(Boolean).length;

		let summary = "";
		if (pulledUpdates) {
			summary += "Получены обновления. ";
		}
		if (filesChanged > 0) {
			await execute('git commit -m "PC auto-sync"');
			await execute("git push");
			summary += "Изменения отправлены. ";
		} else {
			summary += "Нет изменений. ";
		}

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		notify(
			`✅ ${pluginName}: ${summary}Синхронизировано за ${duration} с. Изменено файлов: ${filesChanged}`,
			silent,
		);
	} catch (e: unknown) {
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		const msg = e instanceof Error ? e.message : String(e);
		notify(`❌ ${pluginName} Ошибка (${duration} с): ${msg}`, false, 0);
	}
}
