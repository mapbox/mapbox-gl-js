/* eslint-disable import/no-commonjs */

const puppeteer = require('puppeteer');
const fs = require('fs');
const st = require('st');
const {createServer} = require('http');


async function countInstancesInMemory(page, prototype) {
    // Query all buffer instances into an array
    const instances = await page.queryObjects(prototype);
    // Count amount of buffer objects in heap
    const count = await page.evaluate((buffers) => buffers.length, instances);
    await instances.dispose();
    await prototype.dispose();

    return count;
}

async function getJsHeapStats(page) {
    const {JSHeapUsedSize, JSHeapTotalSize} = await page.metrics();
    return {
        memoryUsed: JSHeapUsedSize * 1e-6,
        memoryTotal: JSHeapTotalSize * 1e-6,
        percentMemoryUsed: JSHeapUsedSize / JSHeapTotalSize
    };
}

(async () => {
    const server = createServer(st({
        path: process.cwd(),
        cache: false,
        index: 'index.html'
    })).listen(9966);

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1024, height: 1024, deviceScaleFactor: 2});
    await page.goto('http://localhost:9966/bench/metrics.html');

    const runResults = {};

    const onConsole = async (msg) => {
        const messageText = msg.text();

        //Only process console message that contain the PUPETEER keybord
        if (messageText.includes('PUPPETEER')) {
            const commandTxt = messageText.substring(
                messageText.indexOf('['),
                messageText.indexOf(']')
            );
            const command = commandTxt.split('|')[1];

            switch (command) {
            case 'RUN_FINISHED':
                getJsHeapStats(page).then((memoryStats) => {
                    // 1. combine results from browser and pupeteer profiling
                    const json = JSON.parse(messageText.substring(messageText.indexOf(':') + 1, messageText.length));
                    const runName  = json.name;
                    const allStats = {...memoryStats, ...json.metrics};

                    if (!runResults[runName]) {
                        runResults[runName] = [];
                    }
                    runResults[runName].push(allStats);

                    // 2. Message Browser to move to next run
                    page.evaluate(() => window.mbglMetrics.nextRun());
                });

                break;
            case 'SUITE_FINISHED':
                await page.close();
                await browser.close();
                server.close();

                const suiteSummary = {};
                for (const runName in runResults) {
                    const stats = runResults[runName];
                    const avg = mean(stats);
                    const dev = stdDev(stats, avg);

                    const runSummary = {};
                    for (const statName in avg) {
                        runSummary[statName] = {average: avg[statName], standardDeviation: dev[statName]};
                    }
                    suiteSummary[runName] = runSummary;
                }

                console.log(suiteSummary);
                fs.writeFileSync('bench/dist/metrics-summary.json', JSON.stringify(suiteSummary, null, 2));
                fs.writeFileSync('bench/dist/metrics-raw.json', JSON.stringify(runResults, null, 2));
                break;
            default:
                console.log(`${command} is unknown`);
            }

        }
        // Get a handle to the ArrayBuffer object prototype
        // const arrayBufferPrototype = page.evaluateHandle(() => ArrayBuffer.prototype);
        // const arrayBufferCount = countInstancesInMemory(page, arrayBufferPrototype);

        // // Get a handle to the Object prototype
        // const objectPrototype = page.evaluateHandle(() => Object.prototype);
        // const objectCount = countInstancesInMemory(page, objectPrototype);
    };
    page.on('console', onConsole);
})();

function mean(stats) {
    const sum = {};
    for (const statName in stats[0]) {
        sum[statName] = 0;
    }

    for (const stat of stats) {
        for (const statName in sum) {
            sum[statName] += stat[statName];
        }
    }

    for (const statName in sum) {
        sum[statName] /= stats.length;
    }
    return sum;
}

function stdDev(stats, avg) {
    // square deviations
    const deviations = stats.map((stat) => {
        const dev = {};
        for (const statName in avg) {
            dev[statName] = Math.pow(stat[statName] - avg[statName], 2);
        }
        return dev;
    });

    const variance = mean(deviations);
    for (const statName in variance) {
        variance[statName] = Math.sqrt(variance[statName]);
    }

    return variance;
}
