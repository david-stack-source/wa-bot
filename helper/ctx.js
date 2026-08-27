import {
    downloadContentFromMessage,
    jidDecode,
    generateForwardMessageContent,
    generateWAMessageFromContent,
} from "baileys";

import fs from "fs";
import { fileTypeFromBuffer } from "file-type";

import { CONVERTER, EXIF } from "./tool.js";

import * as func from "./func.js";

const Convert = new CONVERTER();
const Exif = new EXIF(Convert);

/**
 * Simple Function for ctx Object
 * @param {Object} ctx - Object Binding
 * @param {Object} store - Memory Store instance
 * @param {Object} opt - Additional options
 * @returns {Promise<Object>} WhatsApp context
 */
export default function ObjectFunction(ctx, store, opt) {
    /**
     * Decode WhatsApp JID
     * @param {string | undefined | null} jid - Raw WhatsApp JID
     * @returns {string | undefined} Normalized JID (user@server) or undefined if empty
     */
    ctx.decodeJid = function(jid) {
        if (!jid) return;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return ((decode.user && decode.server && decode.user + "@" + decode.server) || jid);
        } else return jid;
    };

    /**
     * Send text message with automatic @mentions parsing.
     * It extracts numbers from text like "@number" and converts them to WhatsApp JIDs.
     *
     * @param {string} id - Target JID (chat ID)
     * @param {string} txt - Message text containing @mentions
     * @param {Object} [quoted] - Message object to reply to
     * @param {Object} [opt={}] - Additional sendMessage options
     * @returns {Promise<void>}
     */
    ctx.sendMentions = async(id, txt, quoted, opt = {}) => {
        await client.sendMessage(id, {
            text: txt,
            mentions: [...txt.matchAll(/@(\d{0,16})/g)].map(x => x[1] + "@s.whatsapp.net"),
            ...opt
        }, { quoted });
    };
    
    /**
     * Send plain text message.
     * @param {string} jid - Target JID (chat ID)
     * @param {string} text - Message text
     * @param {Object} [quoted] - Message object to reply to
     * @param {Object} [opt={}] - Additional sendMessage options
     * @returns {Promise<void>}
     */
    ctx.sendText = async(jid, text, quoted, opt = {}) => {
        await ctx.sendMessage(jid, {
            text,
            ...opt
        }, quoted ? { quoted } : {});
    };
    
    /**
     * Send reaction emoji to a message.
     * @param {string} jid - Target JID (chat ID)
     * @param {string} emoji - Emoji reaction
     * @param {Object} m - Message object containing message key
     * @returns {Promise<any>}
     */
    ctx.sendReact = async(jid, emoji, m) => {
        await ctx.sendMessage(jid, {
            react: {
                text: emoji,
                key: m.key
            }
        });
    };

    /**
     * Copy and forward a message to another chat, with options for forwarding score and additional attributes.
     * @param {string} jid - Target JID (chat ID) to forward the message to
     * @param {Object} message - Original message object to be forwarded
     * @param {boolean|number} forwardingScore - If true, adds a forwarding score of 1; if a number, adds that score to the message's contextInfo
     * @param {Object} options - Additional options to include in the forwarded message's contextInfo
     * @returns {Promise<Object>} The message object of the forwarded message
     */
    ctx.copyNForward = async (jid, message, forwardingScore = true, options = {}) => {
        let m = generateForwardMessageContent(message, !!forwardingScore);
        let mtype = Object.keys(m)[0];
        if (forwardingScore && typeof forwardingScore == "number" && forwardingScore > 1)
        m[mtype].contextInfo.forwardingScore += forwardingScore;
        m = generateWAMessageFromContent(jid, m, {
            ...options,
            userJid: await ctx.decodeJid(ctx.user.id),
        });
        await ctx.relayMessage(jid, m.message, {
            messageId: m.key.id,
            additionalAttributes: { 
                ...options 
            }
        });
        return m;
    };

    /**
     * Downloads and buffers message content from WhatsApp
     * Handles various message types (image, video, audio, document, etc.)
     * by streaming and concatenating the content into a single Buffer
     *
     * @param {Object} msg - Message object containing media information
     * @param {Object} msg.msg - Alternative message object (fallback)
     * @param {string} msg.mimetype - MIME type of the media (e.g., "image/jpeg")
     * @param {string} msg.mtype - Message type string (e.g., "imageMessage", "videoMessage")
     * @returns {Promise<Buffer>} Buffer containing the complete downloaded message content
     * @throws {Error} If download fails or stream encounters an error
     * @example
     * // Download an image message
     * const imageBuffer = await ctx.downloadMessage(messageObject);
     * // Use the buffer to save file, process, etc.
     * fs.writeFileSync('downloaded_image.jpg', imageBuffer);
     */
    ctx.downloadMessage = async (msg) => {
        let mime = (msg.msg || msg).mimetype || "";
        let type = msg.mtype ? msg.mtype.replace(/Message/gi, "") : mime.split("/")[0];
        let stream = await downloadContentFromMessage(msg, type);
        let buff = Buffer.from([]);
        for await(let i of stream) {
            buff = Buffer.concat([buff, i]);
        };
        return buff;
    };

    /**
     * Get file information and content from various sources (Buffer, data URI, URL, local file)
     * Supports returning file as a temporary file path if returnAsFilename is true
     * @param {Buffer | string} PATH - Input source (Buffer, data URI string, URL string, or local file path)
     * @param {boolean} returnAsFilename - If true, saves the file to a temporary location and returns the filename instead of buffer
     * @returns {Promise<{ res: Response | undefined, filename: string | undefined, mime: string, ext: string, data: Buffer, deleteFile: Function }>} Object containing file information and content
     */
    ctx.getFile = async (PATH, returnAsFilename) => {
        let res;
        let filename;
        let data;
        if (Buffer.isBuffer(PATH)) {
            data = PATH;
        } else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
            data = Buffer.from(PATH.split(",")[1], "base64");
        } else if (/^https?:\/\//.test(PATH)) {
            res = await fetch(PATH);
            data = await res.buffer();
        } else if (fs.existsSync(PATH)) {
            filename = PATH;
            data = fs.readFileSync(PATH);
        } else if (typeof PATH === "string") {
            data = PATH;
        } else {
            data = Buffer.alloc(0);
        };

        if (!Buffer.isBuffer(data)) {
            throw new TypeError("Result is not a buffer");
        };

        const type = (await fileTypeFromBuffer(data)) || {
            mime: "application/octet-stream",
            ext: ".bin"
        };

        if (data && returnAsFilename && !filename) {
            filename = func.tmpFolder(type.ext);
            await fs.promises.writeFile(filename, data);
        };

        return {
            res,
            filename,
            ...type,
            data,
            deleteFile() {
                return filename && fs.promises.unlink(filename);
            }
        };
    };

    /**
     * Sends a file to a specified WhatsApp user or group
     * @param {string} jid - Target JID (chat ID) to send the file to
     * @param {Buffer | string} path - Path to the file to send
     * @param {string} filename - Name of the file
     * @param {string} caption - Caption for the file
     * @param {Object} quoted - Quoted message object
     * @param {boolean} ptt - Whether the file is a voice note
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Promise resolving to the sent message object
     */
    ctx.sendFile = async (jid, path, filename = "", caption = "", quoted, ptt = false, options = {}) => {
        let type = await ctx.getFile(path, true);
        let { 
            res,
            data: file,
            filename: pathFile
        } = type;
        if ((res && res.status !== 200) || file.length <= 65536) {
            try {
                throw { 
                    json: JSON.parse(file.toString()) 
                };
            } catch (e) {
                if (e.json) throw e.json;
            };
        };
        let opt = { filename };
        if (quoted) opt.quoted = quoted;
        if (!type) options.document = true;
        let mtype = "", mimetype = type.mime, convert;
        if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.sticker)) {
        mtype = "sticker";
        } else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.image)) {
            mtype = "image";
        } else if (/video/.test(type.mime)) {
            mtype = "video";
        } else if (/audio/.test(type.mime)) {
            (convert = await (ptt ? Convert.toPTT : Convert.toAudio)(file, type.ext)), (file = convert.data), (pathFile = convert.filename), (mtype = "audio"), (mimetype = "audio/mpeg");
        } else {
            mtype = "document";
        }
        if (options.document) mtype = "document";
        let message = {
            ...options,
            caption,
            filename,
            ptt,
            [mtype]: { 
                url: pathFile 
            },
            mimetype,
        };
        let m;
        try {
            m = await ctx.sendMessage(jid, message, { 
                ...opt,
                ...options
            });
        } catch (e) {
            console.error(e);
            m = null;
        } finally {
            if (!m) m = await ctx.sendMessage(jid, { 
                ...message, 
                [mtype]: file 
            }, { 
                ...opt, 
                ...options, 
                ...ephemeral 
            });
            return m;
        };
    };

    /**
     * Send a sticker to a specified WhatsApp user or group, with support for various input types and optional metadata.
     * @param {string} jid - Target JID (chat ID) to send the sticker to
     * @param {Buffer | string} path - Path to the sticker file
     * @param {Object} quoted - Quoted message object
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} Promise resolving to the sent sticker buffer
     */
    ctx.sendSticker = async (jid, path, quoted, options = {}) => {
        let buff;
        if (Buffer.isBuffer(path)) {
            buff = path;
        } else if (/^data:.*?\/.*?;base64,/i.test(path)) {
            buff = Buffer.from(path.split(",")[1], "base64");
        } else if (/^https?:\/\//i.test(path)) {
            const res = await fetch(path);
            buff = Buffer.from(await res.arrayBuffer());
        } else if (fs.existsSync(path)) {
            buff = fs.readFileSync(path);
        } else {
            logger.error(new Error("Invalid path for sticker"), "STICKER");
        };
    
        if (!Buffer.isBuffer(buff) || !buff.length)
            logger.error(new Error("Failed to load buffer from input source"), "STICKER");
        const mimeData = await fileTypeFromBuffer(buff);
        const isVideo = mimeData?.mime?.startsWith("video");
    
        let buffer;
        if (options.packname || options.author) {
            buffer = isVideo
                ? await Exif.writeExifVid(buff, options)
                : await Exif.writeExifImg(buff, options);
        } else {
            buffer = isVideo
                ? await Exif.videoToWebp(buff)
                : await Exif.imageToWebp(buff);
        };
    
        await ctx.sendMessage(jid, {
            sticker: { url: buffer },
            ...options
        }, {
            quoted
        });
    
        return buffer;
    };
};

import { fileURLToPath } from "node:url";
import { logger } from "./log.js";
func.reloadFile(fileURLToPath(import.meta.url));