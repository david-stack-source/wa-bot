function getJid(participant) {
    return (
        participant?.phoneNumber ||
        participant?.id ||
        participant?.jid ||
        ''
    );
}

function getTarget(m) {
    return m.quoted || m;
}

function getTargetType(target) {
    const type = target?.mtype || target?.type || '';

    if (
        type === 'conversation' ||
        type === 'extendedTextMessage' ||
        type === 'text'
    ) {
        return 'text';
    }

    if (type.includes('image')) {
        return 'image';
    }

    if (type.includes('video')) {
        return 'video';
    }

    if (type.includes('audio')) {
        return 'audio';
    }

    if (type.includes('sticker')) {
        return 'sticker';
    }

    if (type.includes('document')) {
        return 'document';
    }

    if (
        typeof target?.text === 'string' &&
        target.text.trim()
    ) {
        return 'text';
    }

    return 'unknown';
}

function getTargetText(target) {
    if (!target) {
        return '';
    }

    if (typeof target.text === 'string') {
        return target.text.trim();
    }

    if (typeof target.body === 'string') {
        return target.body.trim();
    }

    return '';
}

function getMention(jid) {
    return `@${jid.split('@')[0]}`;
}

function getMentionText(members) {
    return members
        .map(getMention)
        .join(' ');
}

async function sendMedia(ctx, groupId, target, type, data) {
    const {
        buffer,
        caption = '',
        mentions = []
    } = data;

    switch (type) {
        case 'image':
            return ctx.sendMessage(groupId, {
                image: buffer,
                caption,
                mentions
            });

        case 'video':
            return ctx.sendMessage(groupId, {
                video: buffer,
                caption,
                mentions
            });

        case 'audio':
            return ctx.sendMessage(groupId, {
                audio: buffer,
                mimetype: target?.mimetype,
                ptt: target?.ptt || false,
                mentions
            });

        case 'sticker':
            return ctx.sendMessage(groupId, {
                sticker: buffer,
                mentions
            });

        case 'document':
            return ctx.sendMessage(groupId, {
                document: buffer,
                mimetype: target?.mimetype,
                fileName: target?.fileName || 'document',
                caption,
                mentions
            });

        default:
            throw new Error(`Unsupported media type: ${type}`);
    }
}

async function downloadTarget(target) {
    if (!target?.download) {
        throw new Error('Media download function is unavailable.');
    }

    const buffer = await target.download();

    if (!buffer) {
        throw new Error('Failed to download media.');
    }

    return buffer;
}

export default {
    cmd: ['tag', 't'],
    category: 'owner',
    desc: 'Tag system group',

    setting: {
        owner: true,
        hidden: true
    },

    async run(m, {
        ctx,
        p_c,
        participants
    }) {
        const react = async (emoji) => {
            try {
                await ctx.sendReact(m.chat, emoji, m);
            } catch (error) {
                console.error('[TAG] React error:', error);
            }
        };

        try {
            await react('⏳');

            const typeArg = m.args[0]?.toLowerCase();

            const typeMap = {
                '-ta': 'tagall',
                '-ht': 'hidetag',
                '-rt': 'randomtag'
            };

            const type = typeMap[typeArg];

            if (!type) {
                await react('❌');

                return m.reply(
                    `*Tag System*\n\n` +

                    `*Tag all members:*\n` +
                    `${p_c} -ta Hello everyone\n` +
                    `${p_c} -ta\n\n` +

                    `*Hide tag all members:*\n` +
                    `${p_c} -ht Announcement\n` +
                    `${p_c} -ht\n\n` +

                    `*Random tag:*\n` +
                    `${p_c} -rt Wake up!\n` +
                    `${p_c} -rt\n\n` +

                    `*Reply to a message:*\n` +
                    `Reply to a text, image, video, sticker, or audio:\n` +
                    `${p_c} -ta\n` +
                    `${p_c} -ht\n` +
                    `${p_c} -rt\n\n` +

                    `*Outside a group:*\n` +
                    `${p_c} -ta 123456789@g.us Hello everyone`
                );
            }

            /*
             * ==========================
             * GROUP
             * ==========================
             */

            let groupId;
            let text;

            if (m.isGroup) {
                groupId = m.chat;
                text = m.args
                    .slice(1)
                    .join(' ')
                    .trim();
            } else {
                groupId = m.args[1];

                if (
                    !groupId ||
                    !groupId.endsWith('@g.us')
                ) {
                    await react('❌');

                    return m.reply(
                        `Invalid Group ID.\n\n` +
                        `Example:\n` +
                        `${p_c} -ta 123456789@g.us Hello everyone`
                    );
                }

                text = m.args
                    .slice(2)
                    .join(' ')
                    .trim();
            }

            /*
             * ==========================
             * PARTICIPANTS
             * ==========================
             */

            let groupParticipants = participants;

            if (!groupParticipants?.length) {
                const metadata =
                    await ctx.groupMetadata(groupId);

                groupParticipants =
                    metadata?.participants || [];
            }

            const selfJid =
                await ctx.decodeJid(ctx.user.id);

            const members = groupParticipants
                .map(getJid)
                .filter(Boolean)
                .filter(jid => jid !== selfJid);

            if (!members.length) {
                await react('❌');

                return m.reply(
                    'No members found in the group.'
                );
            }

            /*
             * ==========================
             * TARGET
             * ==========================
             */

            const target = getTarget(m);
            const targetType = getTargetType(target);
            const quotedText = getTargetText(target);

            /*
             * Text supplied directly has
             * higher priority than quoted text.
             */
            const finalText =
                text || quotedText;

            /*
             * ==========================
             * VALIDATE TARGET
             * ==========================
             */

            if (
                m.quoted &&
                targetType === 'unknown'
            ) {
                await react('❌');

                return m.reply(
                    'The replied message type is not supported.'
                );
            }

            /*
             * Sticker / audio cannot have
             * visible mentions as caption.
             *
             * Therefore:
             *
             * -ta sticker ❌
             * -rt sticker ❌
             * -ta audio   ❌
             * -rt audio   ❌
             *
             * -ht supports them.
             */
            if (
                ['tagall', 'randomtag'].includes(type) &&
                ['sticker', 'audio'].includes(targetType)
            ) {
                await react('❌');

                return m.reply(
                    `*${type}* cannot be used with ` +
                    `*${targetType}* because it does not support captions.\n\n` +
                    `Use *-ht* instead.`
                );
            }

            /*
             * ==========================
             * RANDOM TAG
             * ==========================
             */

            if (type === 'randomtag') {
                const random =
                    members[
                        Math.floor(
                            Math.random() *
                            members.length
                        )
                    ];

                const mention =
                    getMention(random);

                const caption = finalText
                    ? `${finalText}\n\n${mention}`
                    : mention;

                /*
                 * Text
                 */
                if (targetType === 'text') {
                    await ctx.sendMessage(groupId, {
                        text: caption,
                        mentions: [random]
                    });

                    await react('✅');
                    return;
                }

                /*
                 * Image / Video / Document
                 */
                if (
                    ['image', 'video', 'document']
                        .includes(targetType)
                ) {
                    const buffer =
                        await downloadTarget(target);

                    await sendMedia(
                        ctx,
                        groupId,
                        target,
                        targetType,
                        {
                            buffer,
                            caption,
                            mentions: [random]
                        }
                    );

                    await react('✅');
                    return;
                }

                throw new Error(
                    `Unsupported target type: ${targetType}`
                );
            }

            /*
             * ==========================
             * TAG ALL
             * ==========================
             */

            if (type === 'tagall') {
                const mentionsText =
                    getMentionText(members);

                const caption = finalText
                    ? `${finalText}\n\n${mentionsText}`
                    : mentionsText;

                /*
                 * Text
                 */
                if (targetType === 'text') {
                    await ctx.sendMessage(groupId, {
                        text: caption,
                        mentions: members
                    });

                    await react('✅');
                    return;
                }

                /*
                 * Image / Video / Document
                 */
                if (
                    ['image', 'video', 'document']
                        .includes(targetType)
                ) {
                    const buffer =
                        await downloadTarget(target);

                    await sendMedia(
                        ctx,
                        groupId,
                        target,
                        targetType,
                        {
                            buffer,
                            caption,
                            mentions: members
                        }
                    );

                    await react('✅');
                    return;
                }

                throw new Error(
                    `Unsupported target type: ${targetType}`
                );
            }

            /*
             * ==========================
             * HIDE TAG
             * ==========================
             */

            if (type === 'hidetag') {
                /*
                 * Text
                 */
                if (targetType === 'text') {
                    await ctx.sendMessage(groupId, {
                        text: finalText || '\u200B',
                        mentions: members
                    });

                    await react('✅');
                    return;
                }

                /*
                 * All supported media
                 */
                if (
                    [
                        'image',
                        'video',
                        'audio',
                        'sticker',
                        'document'
                    ].includes(targetType)
                ) {
                    const buffer =
                        await downloadTarget(target);

                    await sendMedia(
                        ctx,
                        groupId,
                        target,
                        targetType,
                        {
                            buffer,
                            caption: text || '',
                            mentions: members
                        }
                    );

                    await react('✅');
                    return;
                }

                throw new Error(
                    `Unsupported target type: ${targetType}`
                );
            }

            throw new Error(
                `Unknown tag type: ${type}`
            );

        } catch (error) {
            console.error(
                '[TAG SYSTEM ERROR]',
                error
            );

            await react('❌');

            return m.reply(
                `Tag system failed.\n\n` +
                `Error: ${error?.message || 'Unknown error'}`
            );
        }
    },

    error: 0
};