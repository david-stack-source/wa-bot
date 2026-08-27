export default {
    cmd: ['rvo', 'apatuh'],
    category: 'tools',
    desc: 'Read View Once Message',
    setting: {
        owner: true
    },

    async run(m, { ctx, func, store }) {
        try {
            if (!m.quoted) {
                return m.reply(func.texted('bold', 'Reply view once message to use this command.'));
            };

            let msg = m.quoted.message;
            if (!msg && store) {
                const data = store.loadMessage(m.chat, m.quoted.id);
                msg = data?.message;
            };

            if (!msg) {
                return m.reply(func.texted('bold', 'Message not found (RAM / store).'));
            };
            let type = Object.keys(msg)[0];
            let q = msg[type];

            if (q?.viewOnceMessage) {
                type = Object.keys(q.viewOnceMessage.message)[0];
                q = q.viewOnceMessage.message[type];
            };

            const media = await ctx.downloadMessage(q);

            if (/video/.test(type) || /image/.test(type)) {
                return await ctx.sendFile(
                    m.chat,
                    media,
                    '',
                    q.caption || '',
                    m
                );
            };
            return m.reply(func.texted('bold', 'this is not a viewonce message'));

        } catch (e) {
            console.log(e);
            return m.reply(func.jsonFormat.stringify(e));
        }
    },

    error: 0
};