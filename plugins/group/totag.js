import { proto } from 'baileys';

const message = proto.WebMessageInfo;

function CustomMessage(remotedJid) {
    return message.fromObject({
        key: {
            remotedJid: remotedJid?.quoted?.key?.remoteJid || remotedJid?.quoted?.chat,
            fromMe: remotedJid?.quoted?.fromMe || false,
            id: remotedJid?.quoted?.id || remotedJid?.quoted?.key?.id || "",
        },
        message: remotedJid?.quoted,
        ...(remotedJid?.isGroup ? {
            participant: remotedJid.quoted?.key?.participant ? remotedJid.quoted.key.participant : remotedJid?.quoted?.sender || ''
        } : {})
    });
};

export default {
    cmd: ['totag'],
    category: 'group',
    desc: 'Tag all members in the group',
    setting: {
        group: true,
    },
    run: async(m, {
        ctx,
        participants,
    }) => {
        let x = participants.map(x => x.phoneNumber).filter(async(v) => v !== await ctx.decodeJid(ctx.user.id));
        //let obj = CustomMessage(m);
        await ctx.sendMessage(m.chat, {
            forward: m.quoted,
            force: true,
            mentions: x
        });
    },
    error: 0
};