import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import { logger } from './helper/log.js';
import { reloadFile } from './helper/func.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showSystemInfo() {
    logger.title('System Information');

    console.log(
        chalk.gray('OS        :'), chalk.white(os.platform(), os.release())
    );
    console.log(
        chalk.gray('Arch      :'), chalk.white(os.arch())
    );
    console.log(
        chalk.gray('Hostname  :'), chalk.white(os.hostname())
    );
    console.log(
        chalk.gray('Memory    :'),
        chalk.white(
            `${(os.freemem() / 1024 / 1024).toFixed(0)} MB free / ` +
            `${(os.totalmem() / 1024 / 1024).toFixed(0)} MB`
        )
    );

    logger.divider();
};

function showStartupBanner() {
    console.log();
    console.log(
        chalk.bold.cyan('⚡ Starting Service...')
    );
    console.log(
        chalk.gray('Please wait while the system initializes')
    );
    logger.divider();
};

function start() {
    const args = [
        path.join(__dirname, 'socket/socket.js'),
        ...process.argv.slice(2)
    ];

    logger.info('Spawning child process');

    let p = spawn(process.argv[0], args, {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });

    p.on('message', (data) => {
        if (data === 'reset') {
            logger.warn('Restart signal received');
            p.kill();
        };
    })

    p.on('exit', (code) => {
        logger.error('Process exited with code', code);
        logger.info('Restarting process...');
        start();
    });
}

// ===== STARTUP FLOW =====
console.clear();
showStartupBanner();
showSystemInfo();
start();

reloadFile(fileURLToPath(import.meta.url));