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

	try {
		const pullOut = await execute("git pull");
		if (pullOut && !pullOut.includes("Already up to date.")) {
			notify(`✅ ${pluginName}: Получены обновления`);
		}

		await execute("git add .");
		const status = await execute("git status --porcelain");

		if (status.trim().length > 0) {
			await execute('git commit -m "PC auto-sync"');
			await execute("git push");
			notify(`✅ ${pluginName}: Изменения отправлены`, silent);
		} else {
			notify(`✅ ${pluginName}: Нет изменений`, silent);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		notify(`❌ ${pluginName} Ошибка: ${msg}`, false, 0);
	}
}
