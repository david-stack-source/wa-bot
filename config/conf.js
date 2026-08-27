import 'dotenv/config'

export const conf = {
    // Pairing Code Number
    num: process.env.PAIRING_NUMBER,

    // Owner Number
    owner: process.env.OWNER_NUMBER ?? '',

    // Owner Name
    owner_name: process.env.OWNER_NAME ?? 'Owner',

    // Name Sessions Dir
    dir: process.env.SESSION_DIR ?? 'session',

    // Bot Name
    name: process.env.BOT_NAME || 'Bot',

    // Environment Mode
    node: process.env.NODE_ENV ?? 'production',

    // Log Level Mode
    log: process.env.LOG_LEVEL ?? 'info',

    // Bot Default Prefix
    prefix: process.env.PREFIX || '.',

    // Bot Prefixes
    prefixes: process.env.PREFIXES
    ? process.env.PREFIXES
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
    : ['#', '!', '/'],

    // MIN/MAX RAM for PM2
    min_ram: process.env.MIN_RAM || '256',
    max_ram: process.env.MAX_RAM || '512',

    // Clear Session
    clear_session: process.env.CLEAR_SESSION === 'true',

    // Sticker Metadata
    pack: process.env.STICKER_PACK || 'Created By +bot\nAt: +time',
    author: process.env.STICKER_AUTHOR || 'Owner: +owner\nBot Number +num',
};