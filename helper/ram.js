import os from "os";

import { logger } from "./log.js";

export function memory({
    max = 800,
    min = 200,
    interval = 10000
} = {}) {

    setInterval(() => {
        const usedProcess = process.memoryUsage().rss / 1024 / 1024; // MB
        const freeSystem = os.freemem() / 1024 / 1024;               // MB

        if (usedProcess > max) {
            logger.warn(
`[ MEMORY OVERLOAD ]
Process RAM: ${usedProcess.toFixed(2)} MB
Limit: ${max} MB
Restarting...`
            );
            process.exit(1);
        }

        if (freeSystem < min) {
            logger.warn(
`[ SYSTEM RAM CRITICAL ]
Free RAM: ${freeSystem.toFixed(2)} MB
Minimum: ${min} MB
Restarting...`
            );
            process.exit(1);
        }

    }, interval);
}