const { Plugin, Notice } = require('obsidian');
const { exec, execSync } = require('child_process');

module.exports = class GitSyncPlugin extends Plugin {
    async onload() {
        console.log('PC ez Sync Plugin: загрузка');
        const vaultPath = this.app.vault.adapter.basePath;

        // 1. Pull при запуске (асинхронно, чтобы не тормозить интерфейс)
        new Notice('Git: Обновление (Pull)...');
        exec("git pull", { cwd: vaultPath }, (error, stdout, stderr) => {
            if (error) {
                new Notice(`Ошибка Pull: ${error.message}`);
                console.error(error);
                return;
            }
            new Notice('Git: Данные обновлены');
        });

        // 2. Регистрация события выхода из приложения
        // Используем событие 'quit' пространства воркспейса
        this.registerEvent(
            this.app.workspace.on('quit', () => {
                this.syncOnQuit(vaultPath);
            })
        );
    }

    // Метод для синхронизации при закрытии (синхронный)
    syncOnQuit(vaultPath) {
        try {
            // Используем execSync, чтобы процесс дождался завершения команды
            // 2>/dev/null подавляет ошибки, если коммитить нечего
            const command = "git add . && git commit -m 'PC sync' 2>/dev/null && git push";
            
            console.log('PC ez Sync: Выполняю финальный Push...');
            execSync(command, { cwd: vaultPath });
            console.log('PC ez Sync: Финальная синхронизация завершена');
        } catch (e) {
            // Ошибка обычно возникает, если нет изменений для коммита
            console.log('PC ez Sync: Нет изменений для отправки или ошибка сети');
        }
    }

    onunload() {
        console.log('PC ez Sync Plugin: выгрузка');
    }
}
