import { exec, execFile, execFileSync, execSync } from "child_process";

export function runGitCommit(blocking: boolean, cwd: string, message: string): Promise<string> {
	if (blocking) {
		return Promise.resolve(execFileSync("git", ["commit", "-m", message], { cwd }).toString());
	}
	return new Promise((resolve, reject) => {
		execFile("git", ["commit", "-m", message], { cwd }, (err, stdout) => {
			if (err) {
				reject(err instanceof Error ? err : new Error("git commit failed"));
			} else {
				resolve(stdout ?? "");
			}
		});
	});
}

export function createExecute(blocking: boolean, cwd: string): (cmd: string) => Promise<string> {
	if (blocking) {
		return (cmd: string) =>
			Promise.resolve().then(() => execSync(cmd, { cwd, encoding: "utf8" }));
	}
	return (cmd: string) =>
		new Promise((resolve, reject) => {
			exec(cmd, { cwd }, (err, stdout) => {
				if (err) reject(err);
				else resolve(stdout ?? "");
			});
		});
}

export async function countAheadOfUpstream(execute: (cmd: string) => Promise<string>): Promise<number> {
	try {
		const out = await execute("git rev-list --count @{u}..HEAD");
		const n = Number.parseInt(out.trim(), 10);
		return Number.isFinite(n) && n > 0 ? n : 0;
	} catch {
		return 0;
	}
}

export function countUnpushedCommits(vaultPath: string): Promise<number> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["rev-list", "--count", "@{u}..HEAD"],
			{ cwd: vaultPath },
			(err, stdout) => {
				if (err) {
					resolve(0);
					return;
				}
				const n = Number.parseInt(String(stdout).trim(), 10);
				resolve(Number.isFinite(n) && n > 0 ? n : 0);
			},
		);
	});
}
