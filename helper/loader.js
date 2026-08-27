import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { logger } from './log.js';
import * as func from './func.js';

/**
 * @typedef {Object} PluginModule
 * @property {string[]} [cmd]
 * @property {(ctx:any)=>Promise<void>} [run]
 * @property {(ctx:any)=>Promise<void>} [event]
 */

export default class PluginManager {
    constructor(folderPath) {
        this.folderPath = folderPath;
        this.plugins = new Map();
        this.watchers = new Map();
    };

    get() {
        return new Map(this.plugins);
    };

    async importFile(file) {
        const fileUrl =
            pathToFileURL(file).href + `?update=${Date.now()}`;
        const mod = await import(fileUrl);
        return mod.default || mod;
    };

    async load() {
        const baseDir = path.resolve(process.cwd(), this.folderPath);

        logger.info("Loading plugins...");

        await this.scan(baseDir);
        this.watch(baseDir);

        logger.success(`Loaded: ${this.plugins.size} Plugins`);
    };

    async scan(dir) {
        const entries = await fs.promises.readdir(dir);

        for (const entry of entries) {
            const full = path.resolve(dir, entry);
            const stat = await fs.promises.lstat(full);

            if (stat.isSymbolicLink()) continue;

            if (stat.isDirectory()) {
                await this.scan(full);
                this.watch(full); // watch subfolder
            } else if (full.endsWith('.js')) {
                await this.loadFile(full);
            };
        };
    };

    async loadFile(file) {
        const baseDir = path.resolve(process.cwd(), this.folderPath);
        const relative = path
            .relative(baseDir, file)
            .replace(/\\/g, '/');

        try {
            const mod = await this.importFile(file);
            this.plugins.set(relative, mod);
            //logger.info(`Loaded ${relative} Plugin`);
        } catch (err) {
            logger.error(err, `PLUGIN LOAD ERROR ${relative}`);
        };
    };

    watch(dir) {
        if (this.watchers.has(dir)) return;

        const watcher = fs.watch(dir, async (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            const full = path.resolve(dir, filename);
            const baseDir = path.resolve(process.cwd(), this.folderPath);
            const relative = path
                .relative(baseDir, full)
                .replace(/\\/g, '/');

            try {
                if (fs.existsSync(full)) {
                    const mod = await this.importFile(full);
                    this.plugins.set(relative, mod);
                    logger.info(`Reloaded ${relative} Plugin`);
                } else {
                    this.plugins.delete(relative);
                    logger.info(`Removed ${relative} Plugin`);
                }
            } catch (err) {
                logger.error(err, `PLUGIN WATCH ERROR ${relative}`);
            }
        });

        this.watchers.set(dir, watcher);
    };
};

func.reloadFile(fileURLToPath(import.meta.url));