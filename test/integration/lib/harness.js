
import path from 'path';
import * as fs from 'fs';
import {styleText} from 'node:util';
import {compile} from 'yeahjs';
import createServer from './server.js';
// eslint-disable-next-line import-x/order
import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

function shuffle(array, seed) {
    let s = seed >>> 0;
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
        s = Math.imul(s ^ (s >>> 15), 1 | s);
        s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
        const j = ((s ^ (s >>> 14)) >>> 0) % (i + 1);
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

export default async function (directory, implementation, options, run) {
    const server = createServer();

    const testFilter = options.tests || [];
    const ignores = options.ignores || {skip: []};

    let sequence = fs.globSync(`**/${options.fixtureFilename || 'style.json'}`, {cwd: directory})
        .sort((a, b) => a.localeCompare(b, 'en'))
        .map(fixture => {
            // Normalize path separators to forward slashes for cross-platform compatibility
            const id = path.dirname(fixture).replace(/\\/g, '/');
            const style = require(path.join(directory, fixture));

            server.localizeURLs(style);

            style.metadata = style.metadata || {};
            const testName = `${path.basename(directory)}/${id}`;
            style.metadata.test = {id,
                skip: ignores.skip.includes(testName),
                width: 512,
                height: 512,
                pixelRatio: 1,
                allowed: 0.00015, ...style.metadata.test};

            return style;
        })
        .filter(style => {
            const test = style.metadata.test;

            if (testFilter.length !== 0 && !testFilter.some(t => test.id.includes(t))) {
                return false;
            }

            if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && /^debug\//.test(test.id)) {
                console.log(styleText('gray', `* skipped ${test.id}`));
                return false;
            }

            if (test.skip) {
                console.log(styleText('gray', `* skipped ${test.id}`));
                return false;
            }

            return true;
        });

    if (options.shuffle) {
        console.log(styleText('white', `* shuffle seed: `) + styleText('bold', `${options.seed}`));
        sequence = shuffle(sequence, options.seed);
    }

    await server.listen();

    const tests = sequence.map(style => style.metadata.test);

    for (const style of sequence) {
        const test = style.metadata.test;

        // eslint-disable-next-line no-await-in-loop -- tests must run sequentially
        await new Promise((resolve) => {
            function handleResult(error) {
                if (error) {
                    test.error = error;
                }

                if (test.ignored && !test.ok) {
                    test.color = '#9E9E9E';
                    test.status = 'ignored failed';
                    console.log(styleText('white', `* ignore ${test.id} (${test.ignored})`));
                } else if (test.ignored) {
                    test.color = '#E8A408';
                    test.status = 'ignored passed';
                    console.log(styleText('yellow', `* ignore ${test.id} (${test.ignored})`));
                } else if (test.error) {
                    test.color = 'red';
                    test.status = 'errored';
                    console.log(styleText('red', `* errored ${test.id}`));
                } else if (!test.ok) {
                    test.color = 'red';
                    test.status = 'failed';
                    console.log(styleText('red', `* failed ${test.id}`));
                } else {
                    test.color = 'green';
                    test.status = 'passed';
                    console.log(styleText('green', `* passed ${test.id}`));
                }

                resolve();
            }

            try {
                run(style, test, handleResult);
            } catch (error) {
                handleResult(error);
            }
        });
    }

    await server.close();

    if (process.env.UPDATE) {
        console.log(`Updated ${tests.length} tests.`);
        process.exit(0);
    }

    let passedCount = 0,
        ignoreCount = 0,
        ignorePassCount = 0,
        failedCount = 0,
        erroredCount = 0;

    for (const test of tests) {
        if (test.ignored && !test.ok) {
            ignoreCount++;
        } else if (test.ignored) {
            ignorePassCount++;
        } else if (test.error) {
            erroredCount++;
        } else if (!test.ok) {
            failedCount++;
        } else {
            passedCount++;
        }
    }

    const totalCount = passedCount + ignorePassCount + ignoreCount + failedCount + erroredCount;
    const pct = (count) => (100 * count / totalCount).toFixed(1);

    if (passedCount > 0) {
        console.log(styleText('green', `${passedCount} passed (${pct(passedCount)}%)`));
    }

    if (ignorePassCount > 0) {
        console.log(styleText('yellow', `${ignorePassCount} passed but were ignored (${pct(ignorePassCount)}%)`));
    }

    if (ignoreCount > 0) {
        console.log(styleText('white', `${ignoreCount} ignored (${pct(ignoreCount)}%)`));
    }

    if (failedCount > 0) {
        console.log(styleText('red', `${failedCount} failed (${pct(failedCount)}%)`));
    }

    if (erroredCount > 0) {
        console.log(styleText('red', `${erroredCount} errored (${pct(erroredCount)}%)`));
    }

    const resultsTemplate = compile(fs.readFileSync(path.join(__dirname, '..', 'results.html.tmpl'), 'utf8'), {locals: ['unsuccessful', 'tests', 'stats', 'shuffle', 'seed']});
    const itemTemplate = compile(fs.readFileSync(path.join(directory, 'result_item.html.tmpl'), 'utf8'), {locals: ['r', 'hasFailedTests']});

    const stats = {};
    for (const test of tests) {
        stats[test.status] = (stats[test.status] || 0) + 1;
    }

    const unsuccessful = tests.filter(test => test.status === 'failed' || test.status === 'errored');

    const resultsShell = resultsTemplate({unsuccessful, tests, stats, shuffle: options.shuffle, seed: options.seed})
        .split('<!-- results go here -->');

    const p = path.join(directory, 'index.html');
    const out = fs.createWriteStream(p);

    await write(out, resultsShell[0]);
    for (const test of tests) {
        const escaped = itemTemplate({r: test, hasFailedTests: unsuccessful.length > 0});
        // Undo lodash.template's escape characters to correctly render "<" and ">" as html.
        const fixed = escaped.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        // eslint-disable-next-line no-await-in-loop -- write backpressure must be sequential
        await write(out, fixed);
    }
    await write(out, resultsShell[1]);
    await new Promise(resolve => { out.end(resolve); });

    console.log(`Results at: ${p}`);
    process.exit((failedCount + erroredCount) === 0 ? 0 : 1);
}

function write(stream, data) {
    return new Promise((resolve) => {
        if (!stream.write(data)) {
            stream.once('drain', resolve);
        } else {
            process.nextTick(resolve);
        }
    });
}
