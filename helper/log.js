import chalk from "chalk";
import { fileURLToPath } from "url";

/**
 * Get the current time
 * @returns {string}
 */

function timeStamp() {
    const now = new Date();

    const date = now.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const time = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    return `${date} ${time}`;
};

/**
 * Logger Object with various logging methods for different log levels (log, info, mode, success, warn, error).
 * Each method formats the log message with a specific prefix and color using chalk.
 * The error method also handles Error objects and prints the stack trace if available.
 */
export const logger = {
    /**
     * Logging message, shown in the console
     * @param  {...string} msg
     * @returns {void}
     */
    log: (...msg) => {
        console.log(
            chalk.cyan('• [ LOG ]'),
            chalk.gray(timeStamp()),
            ...msg
        );
    },

    /**
     * Logging message (info), shown in the console
     * @param  {...string} msg 
     * @returns {void}
     */
    info: (...msg) => {
        console.log(
            chalk.cyan('ℹ [ INFO ]'),
            chalk.gray(timeStamp()),
            ...msg
        );
    },

    /**
     * Logging message (mode), shown in the console
     * @param  {...string} msg 
     * @returns {void}
     */
    mode: (mode) => {
        console.log(
            chalk.gray('⚙ [ MODE ]'),
            chalk.green(mode)
        );
    },

    /**
     * Logging message (success), shown in the console
     * @param  {...string} msg 
     * @returns {void}
     */
    success: (...msg) => {
        console.log(
            chalk.green('✔ [ SUCCESS ]'),
            chalk.gray(timeStamp()),
            ...msg
        );
    },

    /**
     * Logging message (warn), shown in the console
     * @param  {...string} msg 
     * @returns {void}
     */
    warn: (...msg) => {
        console.log(
            chalk.yellow('[!] [ WARN ]'),
            chalk.gray(timeStamp()),
            ...msg
        );
    },

    /**
     * Logging message (info), shown in the console
     * @param {string|Error} err - Error Object or Message Error
     * @param {string} [context] - additional context (Optional)
     * @returns {void}
     */
    error: (err, context = '') => {
        console.log();

        console.error(
            chalk.red('✖ [ ERROR ]'),
            chalk.gray(timeStamp())
        );

        if (context) {
            console.error(
                chalk.gray('Context :'),
                chalk.whiteBright(context)
            );
        };

        console.error(
            chalk.gray('Message :'),
            chalk.redBright(
                err instanceof Error ? err.message : err
            )
        );

        if (err instanceof Error && err.stack) {
            console.error(
                chalk.gray('Stack   :'),
                chalk.gray(err.stack)
            );
        };

        console.error(
            chalk.gray('─'.repeat(40))
        );
    },

    /**
     * Divider Logging Console
     * @returns {void}
     */
    divider: () => console.log(chalk.gray('─'.repeat(42))),

    /**
     * Logging Message (Title), show in console
     * @param {string} text
     * @returns {void}
     */
    title: (text) => {
        console.log()
        console.log(chalk.bold.white(text))
        logger.divider()
    }
};

/**
 * Log incoming message in the console with formatted output
 * @param {Object} m - Serialized message object
 * @param {Object} ctx - WhatsApp context (client)
 * @returns {void}
 * @description This function formats and logs incoming messages to the console, showing details like chat type, sender, message ID, and content.
 * It uses chalk for colored output and includes a timestamp for each logged message.
 * The function checks if the message is from a group or private chat and formats the log accordingly.
 * If the message contains text, it will also log the text content.
 * Finally, it prints a divider line for better readability in the console logs.
 * 
 * Example usage:
 * logIncomingMessage(message, ctx);
 * 
 * Note: This function assumes that the message object (m) has been properly serialized and contains the necessary properties (e.g., isGroup, sender, pushName, mtype, id, body).
 */
export async function logIncomingMessage(m, ctx) {
    const jid =
        m.chat ||
        m.key?.remoteJid ||
        '-';

    const sender =
        m.sender ||
        m.key?.participant ||
        '-';


    /*
     * ========================================
     * MESSAGE TYPE
     * ========================================
     */

    const messageTypes = {
        conversation: '▷ (text)',
        extendedTextMessage: '▷ (text)',

        imageMessage: '▣ (image)',
        videoMessage: '▶ (video)',
        audioMessage: '♪ (audio)',
        documentMessage: '▤ (document)',
        stickerMessage: '◇ (sticker)',

        contactMessage: '● (contact)',
        contactsArrayMessage: '●● (contacts)',

        locationMessage: '⌖ (location)',
        liveLocationMessage: '⌖ (live location)',

        reactionMessage: '♥ (reaction)',

        pollCreationMessage: '☷ (poll)',
        pollUpdateMessage: '☷ (poll update)',

        buttonsResponseMessage: '▣ (button response)',
        listResponseMessage: '☷ (list response)',
        templateButtonReplyMessage: '▣ (template button)',

        ephemeralMessage: '◷ (ephemeral)',
        viewOnceMessage: '◉ (view once)',

        protocolMessage: '⚙ (protocol)',
    };


    /*
     * ========================================
     * CHAT TYPE
     * ========================================
     */

    const isStatus =
        jid.endsWith('@broadcast');

    const isChannel =
        jid.endsWith('@newsletter');

    const isGroup =
        Boolean(m.isGroup);

    let chatType;
    let groupName = null;

    if (isStatus) {
        chatType = chalk.yellow('[ STATUS ]');
    }

    else if (isChannel) {
        chatType = chalk.cyan('[ CHANNEL ]');
    }

    else if (isGroup) {
        chatType = chalk.magenta('[ GROUP ]');

        try {
            const metadata =
                await ctx.groupMetadata(jid);

            groupName =
                metadata?.subject ||
                null;

        } catch {
            groupName = null;
        }
    }

    else {
        chatType = chalk.blue('[ PRIVATE ]');
    }


    /*
     * ========================================
     * FORMAT PHONE NUMBER
     * ========================================
     */

    let phone = null;

    if (sender && sender !== '-') {
        if (sender.endsWith('@s.whatsapp.net')) {
            phone = sender.split('@')[0];
        }

        else if (/^\d+$/.test(sender)) {
            phone = sender;
        }
    }

    let formattedPhone = null;

    if (phone) {
        phone = phone.replace(/\D/g, '');

        // 08xxxxxxxxxx -> 628xxxxxxxxxx
        if (phone.startsWith('08')) {
            phone = `62${phone.slice(1)}`;
        }

        // Indonesia
        if (phone.startsWith('62')) {
            const local = phone.slice(2);

            if (local) {
                const groups = [];

                // Prefix operator
                groups.push(local.slice(0, 3));

                let remaining = local.slice(3);

                // Kelompokkan sisanya
                while (remaining.length > 4) {
                    groups.push(
                        remaining.slice(0, 4)
                    );

                    remaining =
                        remaining.slice(4);
                }

                if (remaining) {
                    groups.push(remaining);
                }

                formattedPhone =
                    `+62 ${groups.join(' ')}`;
            }

            else {
                formattedPhone = '+62';
            }
        }

        // Fallback negara lain
        else {
            formattedPhone = `+${phone}`;
        }
    }


    /*
     * ========================================
     * FORMAT SENDER
     * ========================================
     */

    let formattedSender;

    // Channel tidak perlu nomor
    if (isChannel) {
        formattedSender =
            m.pushName ||
            formattedPhone ||
            sender ||
            '-';
    }

    else if (
        m.pushName &&
        formattedPhone
    ) {
        formattedSender =
            `${m.pushName} (${formattedPhone})`;
    }

    else {
        formattedSender =
            m.pushName ||
            formattedPhone ||
            sender ||
            '-';
    }


    /*
     * ========================================
     * GET MESSAGE TYPE
     * ========================================
     */

    const messageType =
        messageTypes[m.mtype] ||
        `◇ (${m.mtype || 'unknown'})`;


    /*
     * ========================================
     * MESSAGE ID
     * ========================================
     */

    const messageId =
        m.id ||
        m.key?.id ||
        '-';


    /*
     * ========================================
     * MESSAGE CONTENT
     * ========================================
     */

    const hasText =
        typeof m.body === 'string' &&
        m.body.trim();


    /*
     * ========================================
     * LOG
     * ========================================
     */

    console.log();

    console.log(
        chalk.cyan('📩 MESSAGE'),
        chalk.gray(timeStamp())
    );


    const field = (label, value) => {
        console.log(
            chalk.gray(`${label.padEnd(7)}:`),
            value
        );
    };


    field(
        'Chat',
        `${chatType} ${chalk.gray(jid)}`
    );


    if (isGroup && groupName) {
        field(
            'Group',
            chalk.magenta(groupName)
        );
    }


    field(
        'From',
        chalk.whiteBright(formattedSender)
    );


    field(
        'Type',
        chalk.cyan(messageType)
    );


    field(
        'ID',
        chalk.whiteBright(messageId)
    );


    if (hasText) {
        field(
            'Text',
            chalk.white(m.body)
        );
    }

    else {
        field(
            'Message',
            chalk.gray(
                'No message content'
            )
        );
    }


    console.log(
        chalk.gray(
            '─'.repeat(40)
        )
    );
};

import('./func.js').then(({ reloadFile }) => {
    reloadFile(fileURLToPath(import.meta.url));
});