import {
    areJidsSameUser,
    extractMessageContent,
    getContentType,
    isJidGroup,
    isLidUser,
    proto
} from "baileys";

import * as func from "./func.js";

 /**
 * Extract primary message type from a Baileys message object.
 * It ignores internal/system keys like:
 * - senderKeyDistributionMessage
 * - messageContextInfo
 *
 * @param {Record<object, string, any>} msg - Raw message content object
 * @returns {string} Detected message type key
 */
const getTypeMessage = (msg) => {
    let type = Object.keys(msg);
    let TYPE = 
        (!["senderKeyDistributionMessage",
            "MessageContextInfo"
        ].includes(type[0]) && type[0]) || 
        (type.length >= 3 && type[1] !== "messageContextInfo" && type[1]) || 
        type[type.length - 1] || 
        Object.keys(msg)[0];
    return TYPE;
};

/**
 * Get the actual sender JID from a message, handling group and private chats.
 * @param {Object} msg - The message object containing the key with sender information
 * @returns {string} The decoded sender JID
 * @description This function checks if the message is from a group chat and extracts the participant JID accordingly. 
 * For private chats, it returns the remoteJid. It also handles cases where there might be alternative JIDs for users.
 */
const getSender = (msg) => {
    const key = msg.key;
    if (isJidGroup(key.remoteJid)) {
        if (key.participant && isLidUser(key.participant) && key.participantAlt) {
            return key.participantAlt;
        };
        return key.participant || key.participantAlt;
    };

    if (key.remoteJid && isLidUser(key.remoteJid) && key.remoteJidAlt) {
        return key.remoteJidAlt;
    };
    return key.remoteJid;
};

/**
 * Extract the actual message content from a Baileys message object, handling viewOnce messages.
 * @param {Record<string, any>} m - The message object containing the message content
 * @returns {Object} The extracted message content, or undefined if not found
 */
const extractMsg = (m) => {
    if (m.mtype === "viewOnceMessage") {
        const view = m.message?.viewOnceMessage?.message;
        const innerType = view ? getContentType(view) : undefined;
        return innerType ? view[innerType] : undefined;
    }
    return m.message?.[m.mtype];
};

/**
 * Get the text content from a message.
 * @param {Object} msg - The message object containing the text content
 * @returns {string} The extracted text content
 */
const getBody = (msg) => {
    const m = msg.message;
    return (
        m?.conversation ||
        m?.extendedTextMessage?.text ||
        m?.imageMessage?.caption ||
        m?.videoMessage?.caption ||
        ""
    );
};

/**
 * Simple Serialize
 * @param {Object} message (from message.upsert event)
 * @param {WAConnection} ctx
 */
export const Serialize = async(message, ctx) => {
    if (!message) return;
    const msg = proto.WebMessageInfo;
    //const m = msg.fromObject(message);
    const m = message;

    if (m.key) {
        const { id, remoteJid, remoteJidAlt, fromMe, participant } = m.key;

        m.id = id;
        m.fromMe = fromMe;
        
        if (remoteJid?.endsWith("@lid") && remoteJidAlt?.endsWith("@s.whatsapp.net"))
            m.chat = remoteJidAlt;
        else
            // Fallback for Group, Newsletter, Broadcast, or common JID
            m.chat = remoteJid;

        m.isGroup = isJidGroup(m.chat);

        m.isBot =
            m.fromMe ||
            (m.id.length >= 30 && /^(3EB0|BAE|A5)/.test(id));
            
        m.sender = await ctx.decodeJid(fromMe && ctx.user.id || getSender(m) || m.chat || "");
    };

    if (m.message) {
        m.mtype = getContentType(m.message);
        //m.msg = extractMsg(m);
        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype]);
        m.body = getBody(m);
        m.args = m.body.trim().split(/ +/).slice(1) || [];
        m.text = m.args.join(' ');
        m.mentionedJid = m.msg?.contextInfo ? m.msg?.contextInfo?.mentionedJid : [];

        let quoted = m.quoted = m.msg?.contextInfo ? m.msg?.contextInfo?.quotedMessage : null;

        if (quoted) {
            let type = getContentType(quoted);
            m.quoted = m.quoted[type]
            if (['productMessage'].includes(type)) {
                type = getContentType(m.quoted);
                m.quoted = m.quoted[type];
            };
            if (typeof m.quoted === 'string') m.quoted = {
                text: m.quoted
            };
            m.quoted.message = extractMessageContent(m.msg?.contextInfo?.quotedMessage);
            m.quoted.key = {
                remoteJid: m.msg?.contextInfo?.remoteJidAlt || m.chat,
                participant: m.msg?.contextInfo?.remoteJid?.endsWith("@g.us") ? await ctx.decodeJid(m.msg?.contextInfo?.participant) : false,
                fromMe: areJidsSameUser(await ctx.decodeJid(m.msg?.contextInfo?.participant), await ctx.decodeJid(ctx.user.id)),
                id: m.msg?.contextInfo?.stanzaId
            };
            m.quoted.mtype = type;
            m.quoted.id = m.msg.contextInfo.stanzaId;
            m.quoted.chat = m.msg.contextInfo.remoteJidAlt || m.chat;
            m.quoted.sender = await ctx.decodeJid(m.msg.contextInfo.participant);
            m.quoted.fromMe = m.quoted.sender === await ctx.decodeJid(ctx.user.id);
            m.quoted.isBot =
                m.fromMe ||
                (m.quoted.id.length >= 30 && /^(3EB0|BAE|A5)/.test(m.quoted.id));
            m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];

            let quotedMsg = extractMessageContent(m.quoted.message[type]) || m.quoted.message[type];
            m.quoted.body = quotedMsg?.text || quotedMsg?.caption || m.quoted?.message?.conversation || quotedMsg?.selectedButtonId || quotedMsg?.singleSelectReply?.selectedRowId || quotedMsg?.selectedId || quotedMsg?.contentText || quotedMsg?.selectedDisplayText || quotedMsg?.title || quotedMsg?.name || "";
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
            m.quoted.args = m.quoted.body.trim().split(/ +/).filter((x) => x) || [];

            let VM = msg.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id
                },
                message: quoted,
                ...(m.isGroup ? {
                    participant: m.quoted.sender
                } : {})
            });

            m.quoted.delete = () => {
                return ctx.sendMessage(m.quoted.chat, {
                    delete: VM.key
                });
            };

            m.quoted.copyForward = async(jid, force = false, opt = {}) => {
                return await ctx.copyNForward(jid, VM, force, opt);
            };

            m.quoted.download = () => {
                return ctx.downloadMessage(m.quoted);
            };
        };
    };

    /**
     * Reply to this message
     * @param {String|Object} text 
     * @param {String|false} chatId 
     * @param {Object} options 
     */
    m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? ctx.sendMedia(chatId, text, 'file', '', m, {
        ...options
    }) : ctx.sendText(chatId, text, m, {
        ...options
    });

    /**
     * React to this message
     * @param {String} emoji 
     * @returns {Promise} Message reaction result
     */
    m.react = (emoji) => {
        ctx.sendMessage(m.chat, {
            react: {
                text: String(emoji),
                key: m.key,
            },
        });
    };

    return m;
};

import { fileURLToPath } from 'node:url';
func.reloadFile(fileURLToPath(import.meta.url));