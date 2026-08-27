import { Boom } from "@hapi/boom";
import makeWASocket, {
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
} from "baileys";
import fs from 'fs';
import NodeCache from "node-cache";
import path from "path";
import Pino from 'pino';
import { fileURLToPath } from "url";

import { conf } from "../config/conf.js";
import { handleMessage } from "../handle/event.js";
import { logger } from "../helper/log.js";
import { memory } from "../helper/ram.js";
import { Serialize } from "../helper/serialize.js";

import ObjectFunction from "../helper/ctx.js";
import * as func from '../helper/func.js';
import PluginManager from "../helper/loader.js";
import makeInMemoryStore from "../helper/store.js";

//Load Plugins
const pluginManager = new PluginManager('plugins');
if (pluginManager) await pluginManager.load();

//Ram Checker
if (memory) memory({
    max: conf.max_ram,
    min: conf.min_ram,
    interval: 15e3
});

let sessionCleared = false;

async function clearSession() {
    if (sessionCleared) return;
    sessionCleared = true;

    const { readdir, unlink } = await import("fs/promises");

    try {
        const dir = path.resolve(process.cwd(), conf.dir);
        const files = await readdir(dir);

        const trash = files.filter(f => f.startsWith("pre-key"));
        logger.info(`Detected ${trash.length} pre-key trash file`);

        if (!trash.length) return;

        await Promise.all(
            trash.map(file => unlink(path.join(dir, file)))
        );

        logger.success(`Successfully deleted ${trash.length} pre-key file`);

    } catch (err) {
        logger.error(err, "Unable to scan directory:");
    };
};

function deleteSession(sessionPath) {
    const fullPath = path.join(process.cwd(), sessionPath);
    try {
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            logger.success(`Session deleted: ${fullPath}`);
            return true;
        } else {
            logger.warn(`Session not found: ${fullPath}`);
            return false;
        }
    } catch (err) {
        logger.error(err, 'Failed to delete session');
        return false;
    };
};

setInterval(() => {
    const tmpDir = path.join(process.cwd(), "tmp");
    const { readdir, unlink } = fs.promises;
    readdir(tmpDir, (err, files) => {
        if (err) return;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);

            unlink(filePath, err => {
                if (err) return;
            });
        };
    });
}, 10 * 60 * 1000); // Clear temp directory every 10 minutes

export async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(conf.dir);
    const PinoLogger = Pino({
        level: conf.log
    });
    const store = makeInMemoryStore({
        logger: PinoLogger,
        maxMessagesPerChat: 20
    });
    const cache = new NodeCache();
    const { version } = await fetchLatestBaileysVersion();

    const ctx = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, Pino({
                level: "silent",
            }).child({
                level: "silent"
            }))
        },
        logger: PinoLogger,
        version,
        browser: Browsers.windows("Chrome"),
        defaultQueryTimeoutMs: undefined,
        syncFullHistory: true,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        cachedGroupMetadata: async () => undefined,
        getMessage: async (key) => {
        const jid = jidNormalizedUser(key.remoteJid);
            if (store) {
                return store.loadMessage(jid, key.id)?.messages || null;
            };
            return proto.Message.fromObject({});
        }
    });
    store.bind(ctx.ev);
    ObjectFunction(ctx, store);

    const store_file = path.join(process.cwd(), "db", "store.json");

    // Load Store
    if (fs.existsSync(store_file)) {
        const state = fs.readFileSync(store_file);
        store.load(func.jsonFormat.parse(state));
    };

    // Save credentials every 60 seconds
    setInterval(() => {
        const state = store.save()
        fs.writeFileSync(store_file, func.jsonFormat.stringify(state, 2));
    }, 60 * 1000);

    ctx.ev.process(async (ev) => {
        if (ev['creds.update']) await saveCreds();

        if (ev['connection.update']) {
            const {
                connection,
                lastDisconnect
            } = ev['connection.update'];
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        
            if (connection === 'connecting' && !ctx.authState.creds.registered && conf.num) {
                try {
                    logger.info('Request Pairing Code in 3s');
                    await func.sleep('3s');
                    const num = conf.num.replace(/[^0-9]/g, "");
                    const code = await ctx.requestPairingCode(num);
                    logger.success('Pairing Code : ' + code.match(/.{1,4}/g).join("-"));
                } catch (error) {
                    logger.error(error, 'PAIRING');
                    process.exit(1);
                };
            };

            if (connection === 'close') {
                switch (reason) {
                    case DisconnectReason.badSession:
                        logger.warn(`Bad Session!, delete ${conf.dir} and reconnect`);
                        logger.error(reason, 'BAD SESSION');
                        ctx.logout();
                        deleteSession(conf.dir);
                        break;

                    case DisconnectReason.connectionClosed:
                        logger('Connection closed, reconnecting...');
                        process.send('reset');
                        break;

                    case DisconnectReason.connectionLost:
                        logger.warn('Connection lost...');
                        process.send('reset');
                        break;
                    
                    case DisconnectReason.connectionReplaced:
                        logger.warn('Connection changed, please wait...');
                        logger.error(reason, 'CONNECTION CHANGED');
                        ctx.logout();
                        deleteSession(conf.dir);
                        break;

                    case DisconnectReason.loggedOut:
                        logger.warn('Connection Logout, please delete & create your new session');
                        logger.error(reason, 'CONNECTION LOGOUT');
                        ctx.logout();
                        deleteSession(conf.dir);
                        break;

                    case DisconnectReason.restartRequired:
                        logger.info('Needs to restart, please wait...');
                        process.send('reset');
                        break;

                    default:
                        logger.warn(`Connection closed ${reason ?? 'Unknown'}: ${connection ?? 'Unknown'}`);
                        process.send('reset');
                        break;
                };
            };

            if (connection === 'open') {
                logger.success('Successfully connected to :');
                logger.info(func.jsonFormat.stringify(ctx.user, 2));
                if (conf.clear_session) {
                    await clearSession();
                };
            };
        };

        if (ev['messages.upsert']) {
            const upsert = ev['messages.upsert'];
            if (!upsert?.messages?.length) return;
            try {
                let msg = upsert.messages[0];
                if (!upsert.messages) return;
                if (upsert.type !== "notify") return;
                if (msg.key && msg.key.remoteJid === "status@broadcast") return;
                if (msg.message?.protocolMessage) return;

                const message = await Serialize(msg, ctx);
                await handleMessage(ctx, message, store, pluginManager.get());
                
            } catch (error) {
                logger.error(error, 'MESSAGES.UPSERT');
            };
        };
    });
};

connect();

//Reloading File
func.reloadFile(fileURLToPath(import.meta.url));