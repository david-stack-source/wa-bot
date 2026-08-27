import { Serialize } from "../../helper/serialize.js";

async function GetQuotedMessage(msg, store) {
    if (!msg?.quoted?.id) return false;
    return store.loadMessage(msg.chat, msg.quoted.id);
};

export default {
    cmd: ['quoted', 'q'],
    category: 'owner',
    desc: "Get reply chat chat from message",
    setting: {
        owner: true,
        hidden: true
    },

    run: async (m, { func, ctx, store }) => {
        try {
            if (!m.quoted) {
                return m.reply(func.texted('bold', `Reply to a message.`));
            };

            const message = await GetQuotedMessage(m, store);
            if (!message) {
                return m.reply(func.texted('bold', `Quoted message not found in database.`));
            };

            const msg = await Serialize(message, ctx);

            if (!msg.quoted) {
                return m.reply(func.texted('bold', `Message does not contain quoted.`));
            };

            await msg.quoted.copyForward(m.chat, true);
        } catch (e) {
            console.error(e);
            m.reply(String(e));
        };
    },

    error: 0
};