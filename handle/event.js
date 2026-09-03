import { conf } from "../config/conf.js";
import * as func from "../helper/func.js";
import { logger, logIncomingMessage } from "../helper/log.js";

/**
 * Handle command & events plugins
 * @param {Object} ctx - Client context
 * @param {Object} m - Serialized message
 * @param {Object} store - Memory Store instance
 * @param {Object} plugins - Plugins Object
 */
export async function handleMessage(ctx, m, store, plugins) {
    /**
     * Log incoming message details to the console for debugging and monitoring purposes
     */
    try {
        logIncomingMessage(m, ctx);
    } catch (error) {
        logger.error(error, 'Error logging incoming message');
    };

    if (!m.body) return;
    //Bot system
    const defaultPrefix = conf.prefix,
    prefixes = conf.prefixes,
    isCreator = [
        ctx.decodeJid(ctx.user.id),
        conf.owner,
        //...set.owner
    ].map(x => x.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m?.sender),
    isBot = m.fromMe || false;

    // Filter Mode Bot (Self / Public)
    const mode = (conf.mode || 'public').toLowerCase();
 
    // Mode Self
    if (mode === 'self' && !isCreator && !isBot) return;

    // Mode Public
    if (mode === 'public' && isBot && !isCreator) return;

    // Prefix Detection
    let usedPrefix = conf.prefixes.find(p => m.body.startsWith(p));

    if (!usedPrefix && (isCreator || isBot)) usedPrefix = '';
    if (!usedPrefix && m.body.startsWith(conf.prefix)) usedPrefix = conf.prefix;

    if (!usedPrefix && !isCreator && !isBot) return;

    //Command Parsing
    const withoutPrefix = usedPrefix
        ? m.body.slice(usedPrefix.length)
        : m.body;

    const [command] = withoutPrefix.trim().toLowerCase().split(/\s+/);
    if (!command) return;

    //Group system
    const metadata = m.isGroup
        ? await ctx.groupMetadata(m.chat).catch(() => null)
        : null,
    participants = metadata?.participants || [],
    botJid = await ctx.decodeJid(ctx.user.id),
    senderData = participants.find(p => p.phoneNumber === m.sender),
    botData = participants.find(p => p.phoneNumber === botJid),
    isAdmin = senderData?.admin && senderData.admin !== 'member',
    isSuperAdmin = senderData?.admin === 'superadmin',
    isBotAdmin = botData?.admin && botData.admin !== 'member';

    const log = async (type, message) => {
        const types = {
            warn: '[!]',
            error: '[X]',
            info: '[i]',
            success: '[✓]'
        };

        const icon = types[type];
        if (!icon) return;

        await ctx.sendText(m.chat, `${func.texted('bold', icon)} ${message}`, m);
    };

    for (let plugin of plugins.values()) {
        const opt = {
            ctx,
            func,
            conf,
            prefix: usedPrefix,
            command,
            p_c: usedPrefix + command,
            isCreator,
            isBot,
            participants,
            isAdmin,
            isSuperAdmin,
            isBotAdmin,
            store,
            logger,
            plugin,
            plugins
        };

        const rules = {
            owner: [isCreator, 'This command is only for the owner'],
            group: [m.isGroup, 'This command can only be used in a group'],
            private: [!m.isGroup, 'This command can only be used in private chat'],
            admin: [isAdmin, 'This command is only for group admins'],
            quoted: [m.quoted, 'Please quote a message to use this command'],
        };
        
        /**
         * Loop through plugins and execute the matching command, with error handling and logging
         */
        try {
            if (typeof plugin.event === 'function')
                await plugin.event(m, opt);

            if (!plugin.cmd || !Array.isArray(plugin.cmd)) continue;
            if (!plugin.cmd?.includes(command)) continue;

            if (plugin?.use && !m.text) {
                m.reply(plugin?.use.replace("+cmd", command));
                return;
            };
            if (Object.entries(rules).some(([key, [allowed, msg]]) => {
                if (plugin?.setting?.[key] && !allowed) {
                    log('warn', msg);
                    return true;
                };
            })) continue;

            await plugin.run(m, opt);
            break;

        } catch (err) {
            logger.error(err, `Plugin error (${plugin?.cmd && plugin?.cmd[0] ? plugin?.event || 'Unknown' : 'Unknown'})`);
        };
    };
};

import { fileURLToPath } from "node:url";
func.reloadFile(fileURLToPath(import.meta.url));