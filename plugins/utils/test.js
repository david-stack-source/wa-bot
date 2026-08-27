export default {
    cmd: ['test', 'tes'],
    category: 'utils',
    desc: 'Check if the bot is working',
    setting: {
        owner: true
    },
    
    async run (m) {
        let old = performance.now();
        m.reply(`*Response Speed :* ${(performance.now() - old).toFixed(5)} ms`);
    },
    error: 0
};