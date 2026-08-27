import util from 'node:util';
import { exec } from 'node:child_process';

export default {
    event: async (m, {
        ctx,
        isCreator,
        func,
        conf,
        command,
        participants,
        store,
        plugins
    }) => {
        if (m.body.startsWith("->")) {
            if (!isCreator) return;
            let { key } = await ctx.sendMessage(m.chat, {
                text: func.texted("monov1", "E V A L I N G . . .")
            }, { quoted: m });
            try {
                const result = await eval(`(async () => { return ${m.body.slice(2)} })()`);
                return await ctx.sendMessage(m.chat, {
                    text: util.format(result),
                    edit: key,
                });
            } catch (e) {
                return await ctx.sendMessage(m.chat, {
                    text: util.format(e),
                    edit: key,
                });
            };
        };

        if (m.body.startsWith(">>")) {
            if (!isCreator) return;
            let { key } = await ctx.sendMessage(m.chat, {
                text: func.texted("monov1", "E V A L I N G . . .")
            }, { quoted: m });
            try {
                const result = await eval(`(async () => { ${m.body.slice(2)} })()`);
                return await ctx.sendMessage(m.chat, {
                    text: util.inspect(result),
                    edit: key,
                });
            } catch (e) {
                return await ctx.sendMessage(m.chat, {
                    text: util.format(e),
                    edit: key,
                });
            };
        };

        if (m.body.startsWith("$")) {
            if (!isCreator) return;
            let { key } = await ctx.sendMessage(m.chat, {
                text: func.texted("monov1", "E X E C U T I N G . . .")
            }, { quoted: m });
            exec(m.body.slice(2), async (err, stdout) => {
                if (err) return await ctx.sendMessage(m.chat, {
                    text: util.format(err),
                    edit: key
                });
                if (stdout) return await ctx.sendMessage(m.chat, {
                    text: stdout,
                    edit: key
                });
            });
            return;
        };
    }
}