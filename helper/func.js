import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

import { logger } from "./log.js";
/**
 * Delay Function
 * @param {string|number} [time = 0] - Example: 1000 | "5s" | "1m" | "1h"
 * @returns {Promise<void>}
 */
export function sleep(time) {
    let ms = 0;

    if (typeof time === 'number') {
        ms = time;
    } else if (typeof time === 'string') {
        let match = time.match(/^(\d+)\s*(ms|s|m|h)$/i);
        if (!match) {
            logger.error(new Error('Invalid Format'), 'INVALID');
        };

        let value = Number(match[1]);
        let unit = match[2].toLowerCase();

        let multipliers = {
            ms: 1,
            s: 1000,
            m: 60_000,
            h: 3_600_000
        };

        ms = value * multipliers[unit];
    } else {
        logger.error(new Error('must be a Number or String'), 'INVALID');
    };

    return new Promise(resolve => setTimeout(resolve, ms));
};

export const jsonFormat = {
    /**
     * Convert Object -> JSON string
     * @param {Object} data
     * @param {number} space
     * @returns {string}
     */
    stringify(data, space = 2) {
        try {
            return JSON.stringify(data, null, space)
        } catch (err) {
            logger.error(err, 'UNEXPECTED')
        };
    },

    /**
     * Convert JSON string -> Object
     * @param {string} data
     * @returns {Object}
     */
    parse(data) {
        try {
            return JSON.parse(data)
        } catch (err) {
            logger.error(err, 'UNEXPECTED')
        };
    }
};

/**
 * Get paths from meta url
 * @param {string} meta
 * @returns {{ __filename: string, __dirname: string }}
 */
export const getPaths = (meta) => {
    const __filename = fileURLToPath(meta)
    const __dirname = path.dirname(__filename)

    return { __filename, __dirname }
};

/**
 * Reload file (supports meta url or absolute path)
 * @param {string} input - import.meta.url OR absolute file path
 * @returns {Promise<void>}
 */
export const reloadFile = (file) => {
    fs.unwatchFile(file);

    fs.watchFile(file, { interval: 500 }, async () => {
        try {
            const url = `${pathToFileURL(file).href}?update=${Date.now()}`;
            await import(url);

            logger.info(`( Update Files )\n> ${file}`);
        } catch (e) {
            console.error("[ HOT-RELOAD ERROR ]", e);
        }
    });
};

/**
 * escapeFromRegExp Function
 * @param {string} obj RegExp string
 * @returns {string} return string
 */
export function escapeFromRegExp (obj) {
    if (typeof obj !== 'string') return obj;
    return obj.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, "\\$&");
};

/**
 * Simple Function format text style
 * @param {string} type 
 * @param {string} text 
 * @returns {string}
 */
export const texted = (type, text) => {
    switch (type) {
        case "bold": {
            return "*" + text + "*";
        }
        break;
        case "italic": {
            return "_" + text + "_";
        }
        break;
        case "line": {
            return "~" + text + "~";
        }
        break;
        case "monov1": {
            return "```" + text + "```";
        }
        break;
        case "monov2": {
            return "`" + text + "`";
        }
        break;
    }
};

/**
 * Formats bytes into a human-readable string
 * @param {number} bytes 
 * @returns {string}
 */
export const formatSize = (bytes) => {
    const sizes = ['B','KB','MB','GB','TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
};

/**
 * Generate a random alphanumeric string of specified length
 * @param {number} length - Desired length of the generated string
 * @returns {string} Randomly generated string
 */
export const makeId = (length) => {
    var result = "";
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * charactersLength));
    return result;
};

/**
 * Generate a temporary file path with a random name and specified extension
 * @param {string} ext - File extension (e.g., ".jpg", ".txt")
 * @returns {string} Generated temporary file path
 */
export const tmpFolder = (ext) => {
    if (!fs.existsSync(path.join(process.cwd(), "tmp"))) {
        fs.mkdirSync(path.join(process.cwd(), "tmp"));
        logger.info('Create "tmp" folder for temporary file storage');
    };
    return path.resolve(process.cwd(), "tmp/" + makeId(4) + ext);
};

/**
 * Formats seconds into a human-readable string
 * @param {number} sec - Number of seconds
 * @returns {string} Formatted time string
 */
export function formatSeconds(sec) {
    sec = Number(sec);
    let d = Math.floor(sec / 86400);
    let h = Math.floor(sec % 86400 / 3600);
    let m = Math.floor(sec % 3600 / 60);
    let s = Math.floor(sec % 60);
    let result = []
    if (d) result.push(d + 'd');
    if (h) result.push(h + 'h');
    if (m) result.push(m + 'm');
    if (s || result.length === 0) result.push(s + 's');

    return result.join(' ');
};

/**
 * Format Date Function
 * @param {Number} numer - Timestamp or Date object
 * @returns {String} Formatted date string
 */
export function formatDate (numer) {
    const myMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ],
    myDays = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ],

    tgl = new Date(numer),
    day = tgl.getDate(),
    month = tgl.getMonth(),
    thisDay = myDays[tgl.getDay()],
    year = tgl.getFullYear(),
    utc = date.getTime() + (date.getTimezoneOffset() * 60000),
    wib = new Date(utc + (7 * 60 * 60000)),
    jam = wib.getHours().toString().padStart(2, '0'),
    menit = wib.getMinutes().toString().padStart(2, '0'),
    detik = wib.getSeconds().toString().padStart(2, '0');
    return `${thisDay}, ${day} - ${myMonths[month]} - ${year} ${jam}:${menit}:${detik}`;
};

reloadFile(fileURLToPath(import.meta.url));