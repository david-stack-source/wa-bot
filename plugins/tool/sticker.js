export default {
    cmd: ['sticker', 'stiker', 's'],
    category: 'tool',
    desc: 'Convert image/video to sticker',

    async run(m, {
        ctx,
        func,
        conf,
        p_c,
        logger
    }) {
        try {
            let quoted = m.quoted ? m.quoted : m;
            let mtype = (quoted.msg || quoted).mimetype || "";

            const isImage = /image/.test(mtype);
            const isVideo = /video/.test(mtype);
            const isSticker = /sticker/.test(mtype);

            if (!isImage && !isVideo && !isSticker) {
                m.react("❌");
                return m.reply(`Send/Reply image/video with caption *${p_c}*`);
            }

            if (isVideo) {
                const duration = (quoted.msg || quoted).seconds || 0;
                if (duration > 21) {
                    m.react("❌");
                    return m.reply("Max duration 20 seconds!");
                };
            };
            let media = await ctx.downloadMessage(quoted);

            let packname = conf.pack.replace("+bot", conf.name).replace("+time", new Date().toLocaleString());
            let author = conf.author.replace("+owner", conf.owner).replace("+num", await ctx.decodeJid(ctx.user.id));

            await ctx.sendSticker(m.chat, media, m, {
                packname,
                author
            });
            
            m.react("✔️");

        } catch (error) {
            m.reply(String(error));
            logger.error(error, "sticker.js");
            m.react("❌");
        }
    },
    error: 0
};