const { Plugin, Notice } = require('obsidian');
const { exec } = require('child_process');

module.exports = class GitSyncPlugin extends Plugin {
    async onload() {
        new Notice('PC ez Sync: Pulling...');
        this.runGitCommand("git pull", "Данные обновлены", "Ошибка при Pull");
    }

    async onunload() {
        this.runGitCommand(
            "git add . && git commit -m 'PC sync' 2>/dev/null && git push",
            "Изменения сохранены",
            "Ошибка при Push"
        );
    }

    runGitCommand(command, successMsg, errorMsg) {
        const vaultPath = this.app.vault.adapter.basePath;
        exec(command, { cwd: vaultPath }, (error, stdout, stderr) => {
            if (error) {
                new Notice(`${errorMsg}: ${error.message}`);
                return;
            }
            new Notice(successMsg);
        });
    }
}
