const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');
const { exec, execSync } = require('child_process');

const DEFAULT_SETTINGS = { syncInterval: 5 };
const pluginName = 'PC ez Sync';

module.exports = class PcEzSyncPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        const vaultPath = this.app.vault.adapter.basePath;

        // 1. Кнопка на левой панели (Ribbon Icon)
        this.addRibbonIcon('sync', pluginName, () => {
            this.runSync(vaultPath, { silent: false, blocking: false });
        });

        // 2. Вкладка настроек
        this.addSettingTab(new PcEzSyncSettingTab(this.app, this));

        // 3. Запуск при старте
        this.runSync(vaultPath, { silent: false, blocking: false });

        // 4. Инициализация интервала
        this.setupInterval();

        // 5. Синхронизация при выходе
        this.registerEvent(
            this.app.workspace.on('quit', () => {
                this.runSync(vaultPath, { silent: true, blocking: true });
            })
        );
    }

    setupInterval() {
        // Исправлено: удалено лишнее "It" и добавлена очистка
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
        }

        if (this.settings.syncInterval <= 0) {
            return;
        }
        
        const ms = this.settings.syncInterval * 60 * 1000;
        this.intervalId = window.setInterval(() => {
            this.runSync(this.app.vault.adapter.basePath, { silent: true, blocking: false });
        }, ms);
        this.registerInterval(this.intervalId);
    }

    async runSync(path, { silent, blocking }) {
        this.notify(`${pluginName}: Синхронизация...`, silent);

        const execute = (cmd) => {
            if (blocking) {
                try { 
                    return execSync(cmd, { cwd: path }).toString();
                } catch (e) {
                     return ""; 
                }
            }
            return new Promise((resolve, reject) => {
                exec(cmd, { cwd: path }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
            });
        };

        try {
            // Pull
            const pullOut = await execute("git pull");
            if (pullOut && !pullOut.includes('Already up to date.')) {
                this.notify(`✅ ${pluginName}: Получены обновления`);
            }

            // Commit & Push
            await execute("git add .");
            const status = await execute("git status --porcelain");

            if (status.trim().length > 0) {
                await execute('git commit -m "PC auto-sync"');
                await execute("git push");
                this.notify(`✅ ${pluginName}: Изменения отправлены`, silent);
            } else {
                this.notify(`✅ ${pluginName}: Нет изменений`, silent)
            }
        } catch (e) {
            this.notify(`❌ ${pluginName} Ошибка: ${e.message}`, false, 0);
        }
    }

    notify(message, isSilent = false, duration = 5000) {
        const now = new Date().toLocaleTimeString();
        console.log(`[${now}] ${pluginName}: ${message}`);

        if (!isSilent) {
            new Notice(message, duration);
        }
    }

    async loadSettings() { 
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
};

class PcEzSyncSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: pluginName });

        new Setting(containerEl)
            .setName('Интервал (минуты)')
            .setDesc('0 — отключить фоновую синхронизацию.')
            .addText(text => text
                .setValue(this.plugin.settings.syncInterval.toString())
                .onChange(async (v) => {
                    this.plugin.settings.syncInterval = Number(v) || 0;
                    await this.plugin.saveSettings();
                    this.plugin.setupInterval();
                }));
    }
}
