const { Plugin, Notice } = require('obsidian');
const { exec, execSync } = require('child_process');

const pluginName = 'PC ez Sync';

module.exports = class GitSyncPlugin extends Plugin {
    async onload() {
        console.log(`${pluginName}: загрузка`);
        const vaultPath = this.app.vault.adapter.basePath;

        // 1. Pull при запуске (асинхронно, чтобы не тормозить интерфейс)
        new Notice('Git: Обновление (Pull)...');
        exec("git pull", { cwd: vaultPath }, (error, stdout, stderr) => {
            if (error) {
                new Notice(`${pluginName}: Ошибка Pull: ${error.message}`);
                console.error(error);
                return;
            }
            new Notice(`${pluginName}: Данные обновлены`);
        });

        // 2. Регистрация события выхода из приложения
        // Используем событие 'quit' пространства воркспейса
        this.registerEvent(
            this.app.workspace.on('quit', () => {
                this.syncOnQuit(vaultPath);
            })
        );

        this.syncOnQuit(vaultPath);
    }

    // Метод для синхронизации при закрытии (синхронный)
    syncOnQuit(vaultPath) {
        const { execSync } = require('child_process');
        try {
            console.log(`${pluginName}: Начало финальной синхронизации...`);
            
            // 1. Добавляем всё в индекс
            execSync("git add .", { cwd: vaultPath });

            // 2. Проверяем, есть ли что коммитить (status --porcelain вернет пустоту, если чисто)
            const status = execSync("git status --porcelain", { cwd: vaultPath }).toString();
            
            if (status.trim().length > 0) {
                console.log(`${pluginName}: Обнаружены изменения, коммитим...`);
                // Используем флаг -m, чтобы не открывать редактор
                execSync('git commit -m "PC sync"', { cwd: vaultPath });
            } else {
                console.log(`${pluginName}: Изменений нет, пропускаем коммит.`);
            }

            // 3. Отправляем в любом случае (на случай, если были локальные коммиты ранее)
            console.log(`${pluginName}: Выполняю push...`);
            execSync("git push", { cwd: vaultPath });
            
            console.log(`${pluginName}: Успешно завершено.`);
        } catch (e) {
            // Теперь сюда попадут только реальные ошибки (например, нет интернета или ошибка SSH)
            console.error(`${pluginName} Error: `, e.message);
        }
    }

    onunload() {
        console.log(`${pluginName}: выгрузка`);
    }
}
