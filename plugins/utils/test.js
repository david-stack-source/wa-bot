import { performance } from 'perf_hooks';

function getResponse(startTime) {
    const end = performance.now();
    const latencyMs = end - startTime;
    let formatted = '';
    if (latencyMs < 1000)
        formatted = `${latencyMs.toFixed(2)} ms`;
    else
        formatted = `${(latencyMs / 1000).toFixed(2)} s`;
    return {
        latency: latencyMs,
        formatted
    };
};

export default {
    cmd: ['test', 'tes'],
    category: 'utils',
    desc: 'Check if the bot is working',
    setting: {
        owner: true
    },
    
    async run (m) {
        let old = performance.now();
        let response = getResponse(old);
        m.reply(`*Response Speed :* ${response.formatted}`);
    },
    error: 0
};