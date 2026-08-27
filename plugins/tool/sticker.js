export default {
    cmd: ['sticker', 'stiker', 's'],
    category: 'tool',
    desc: 'Convert image/video to sticker',
    setting: {

    },

    async run(m, {
        ctx,
        func,
        conf,
        p_c,
        logger
    }) {
        try {
            let teks = m.quoted ? m.quoted.args.join(" ").split(" ")[1] || "" : m.args.join(" ").split(" ")[1] || "";
            let quoted = m.quoted ? m.quoted : m,
            mtype = (quoted.msg || quoted).mimetype || "";

            if (!quoted) return m.reply(`Reply image/video with caption *${p_c}*`);

            let media = await ctx.downloadMessage(quoted);
            // let media = await quoted ? m.quoted.download() : m.download();
            let packname = conf.pack.replace("+bot", conf.name).replace("+time", new Date().toLocaleString());
            let author = conf.author.replace("+owner", conf.owner).replace("+num", await ctx.decodeJid(ctx.user.id));
            
            if (/image/.test(mtype)) {
                await ctx.sendSticker(m.chat, media, m, {
                    packname,
                    author
                });
                m.react("✔️");
            } else if (/video/.test(mtype)) {
                if ((m.quoted.msg || m.quoted).seconds > 21) {
                    m.reply("Maximum 20 Seconds. . .");
                    return m.react("❌");
                };
                await ctx.sendSticker(m.chat, media, m, {
                    packname,
                    author
                });
                m.react("✔️");
            } else if (/sticker/.test(mtype)) {
                await ctx.sendSticker(m.chat, media, m, {
                    packname,
                    author
                });
                m.react("✔️");
            } else {
                m.reply(`Reply image/video with caption *${p_c}*`);
                m.react("❌");
            };
        } catch (error) {
            m.reply(String(error));
            logger.error(error, "sticker.js");
            //console.error(error);
            m.react("❌");
        };
    },
    error: 0
};