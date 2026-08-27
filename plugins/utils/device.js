import { execSync } from 'node:child_process';
import os from 'node:os';

function ramUsage() {
    const total = os.totalmem()
    const free = os.freemem()
    const used = total - free

    return {
        total,
        used,
        free,
        usedPercent: ((used / total) * 100).toFixed(2),
        freePercent: ((free / total) * 100).toFixed(2)
    };
};

function usageDisk(usedBytes, totalBytes) {
    if (!usedBytes || !totalBytes) return 'Usage: unknown';

    const freeBytes = totalBytes - usedBytes;
    const usedPercent = Math.round((usedBytes / totalBytes) * 100);
    const freePercent = 100 - usedPercent;

    const toGiB = (bytes) => (bytes / (1024 ** 3)).toFixed(1);

    return `Usage: ${toGiB(usedBytes)} GiB used (${usedPercent}%) | ${toGiB(freeBytes)} GiB free (${freePercent}%)`;
};

function cpuInfo() {
    const cpu = os.cpus()
    return {
        model: cpu[0].model,
        cores: cpu.length,
        speed: cpu[0].speed
    }
};

function diskUsage() {
    try {
        const out = execSync("df -h / | tail -1").toString().trim().split(/\s+/)
        return {
            total: out[1],
            used: out[2],
            free: out[3],
            usage: out[4]
        }
    } catch {
        return null
    };
};

function gpuInfo() {
    try {
        return execSync("lspci | grep -i vga").toString().trim()
    } catch {
        return "unknown"
    }
};

const more = String.fromCharCode(8206),
readMore = more.repeat(4201);


export default {
    cmd: ['device', 'd'],
    category: 'utils',
    desc: 'Device information',
    setting: { owner: true },

    run: async (m, { ctx, p_c, func }) => {
        const type = m.args[0]?.toLowerCase();
        const header = (title) => func.texted('monov2', `[ ${title} ]`);
        const getNodeUsage = () => {
            const mem = process.memoryUsage();
            return {
                version: process.version,
                uptime: func.formatSeconds(os.uptime()),
                rss: func.formatSize(mem.rss),
                heapTotal: func.formatSize(mem.heapTotal),
                heapUsed: func.formatSize(mem.heapUsed),
                external: func.formatSize(mem.external),
                arrayBuffers: func.formatSize(mem.arrayBuffers || 0)
            };
        };

        if (['-r', '-c', '-d', '-g', '-n'].includes(type)) {
            let shortOut = '';
            switch (type) {
                case '-r':
                    const ram = ramUsage();
                    shortOut = `${header('RAM')} ${func.formatSize(ram.used)} / ${func.formatSize(ram.total)} (${ram.usedPercent}%)`;
                    break;
                case '-c':
                    const cpu = cpuInfo();
                    shortOut = `${header('CPU')} ${cpu.model} (${cpu.cores} Cores) | Load: ${os.loadavg().map(v => v.toFixed(2)).join(' / ')}`;
                    break;
                case '-d':
                    const disk = diskUsage();
                    shortOut = `${header('DISK')} ${disk?.used || '0'} / ${disk?.total || '0'} (${disk?.usage || '0%'})`;
                    break;
                case '-g':
                    shortOut = `${header('GPU')}\n${gpuInfo()}`;
                    break;
                case '-n':
                    shortOut = `${header('NODE')} ${process.version} | RSS: ${func.formatSize(process.memoryUsage().rss)}`;
                    break;
            }
            return m.reply(shortOut);
        }

        let out = '';

        switch (type) {
            case 'ram': {
                const ram = ramUsage();
                out = `${header('RAM')}

- *Total :* ${func.formatSize(ram.total)}
- *Used :* ${func.formatSize(ram.used)} (${ram.usedPercent}%)
- *Free :* ${func.formatSize(ram.free)} (${ram.freePercent}%)`;
                break;
            }

            case 'cpu': {
                const cpu = cpuInfo();
                out = `${header('CPU')}

- *Model :* ${cpu.model}
- *Cores :* ${cpu.cores}
- *Speed :* ${cpu.speed} MHz
- *Load :* ${os.loadavg().map(v => v.toFixed(2)).join(' / ')}`;
                break;
            }

            case 'disk': {
                const disk = diskUsage();
                out = `${header('DISK')}

- *Total :* ${disk?.total}
- *Used :* ${disk?.used}
- *Free :* ${disk?.free}
- *Usage :* ${disk?.usage}`;
                break;
            }

            case 'gpu':
                out = `${header('GPU')}\n\n${gpuInfo()}`;
                break;

            case 'node': {
                const node = getNodeUsage();
                out = `${header('NODE')}

- *Version :* ${node.version}
- *Uptime :* ${node.uptime}

- *Memory*
- *RSS :* ${node.rss}
- *Heap Total :* ${node.heapTotal}
- *Heap Used :* ${node.heapUsed}
- *External :* ${node.external}
- *Array Buf :* ${node.arrayBuffers}`;
                break;
            }

            case 'simple':
            case 'minimal':
            case 'info':
            case 'i':
            case '-i': {
                const ram = ramUsage();
                const cpu = cpuInfo();
                const disk = diskUsage();
                const res = (await fetch("https://ipwho.is").then(r => r.json()).catch(() => ({}))) || {};

                out = `${header('DEVICE')}

- *OS :* ${os.type()} ${os.release()}
- *CPU :* ${cpu.model}
- *RAM :* ${func.formatSize(ram.used)} (${ram.usedPercent}%) used
- *Uptime :* ${func.formatSeconds(os.uptime())}
- *Disk :* ${disk?.used || 'unknown'} / ${disk?.total || 'unknown'} (${disk?.usage || 'unknown'})
- *Working Dir :* ${process.cwd()}

- *Node :* ${process.version}
${readMore}
${res.connection ? `\`[ Provider Information ]\`

- *ISP :* ${res.connection.isp}
- *ORG :* ${res.connection.org}
- *Type :* ${res.type}
- *Country :* ${res.country} (${res.country_code})
- *Region :* ${res.region}
- *Timezone :* ${res.timezone?.id}` : ""}`;
                break;
            }

            case 'restart':
            case 'reset':
            case 'reboot':
                await m.reply("Restarting. . .");
                await func.sleep(2000);
                return process.send("reset");

            default:
                out = `*Command Device Usage:*
                
> ${p_c} -r
> ${p_c} -c
> ${p_c} -d
> ${p_c} -g
> ${p_c} -n
> ${p_c} reboot`;
                break;
        }

        await m.reply(out);
    },

    error: 0
};