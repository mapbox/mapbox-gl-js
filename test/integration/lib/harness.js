'use strict';

/* eslint-disable no-process-exit */

const fs = require('fs');
const path = require('path');
const queue = require('d3-queue').queue;
const colors = require('colors/safe');
const template = require('lodash').template;

module.exports = function (directory, implementation, options, run) {
    const q = queue(1);
    const server = require('./server')();

    const tests = options.tests || [];
    const ignores = options.ignores || {};

    function shouldRunTest(group, test) {
        if (tests.length === 0)
            return true;

        const id = `${group}/${test}`;

        for (let i = 0; i < tests.length; i++) {
            const k = id.indexOf(tests[i]);
            if (k === 0 || id[k - 1] === '-' || id[k - 1] === '/')
                return true;
        }

        return false;
    }

    q.defer(server.listen);

    fs.readdirSync(directory).forEach((group) => {
        if (
            group === 'index.html' ||
            group === 'results.html.tmpl' ||
            group === 'result_item.html.tmpl' ||
            group[0] === '.'
        ) {
            return;
        }

        fs.readdirSync(path.join(directory, group)).forEach((test) => {
            if (!shouldRunTest(group, test))
                return;

            if (!fs.lstatSync(path.join(directory, group, test)).isDirectory())
                // Skip files in this folder.
                return;

            try {
                if (!fs.lstatSync(path.join(directory, group, test, 'style.json')).isFile())
                    return;
            } catch (err) {
                console.log(colors.blue(`* omitting ${group} ${test} due to missing style`));
                return;
            }

            if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && group === 'debug') {
                console.log(colors.gray(`* skipped ${group} ${test}`));
                return;
            }

            const id = `${path.basename(directory)}/${group}/${test}`;
            const ignored = ignores[id];
            if (/^skip/.test(ignored)) {
                console.log(colors.gray(`* skipped ${group} ${test} (${ignored})`));
                return;
            }

            const style = require(path.join(directory, group, test, 'style.json'));

            server.localizeURLs(style);

            const params = Object.assign({
                group,
                test,
                width: 512,
                height: 512,
                pixelRatio: 1,
                recycleMap: options.recycleMap || false,
                allowed: 0.00015
            }, style.metadata && style.metadata.test, {ignored});

            if ('diff' in params) {
                if (typeof params.diff === 'number') {
                    params.allowed = params.diff;
                } else if (implementation in params.diff) {
                    params.allowed = params.diff[implementation];
                }
            }

            q.defer((callback) => {
                run(style, params, (err) => {
                    if (err) return callback(err);

                    if (params.ignored && !params.ok) {
                        params.color = '#9E9E9E';
                        params.status = 'ignored failed';
                        console.log(colors.white(`* ignore ${params.group} ${params.test} (${params.ignored})`));
                    } else if (params.ignored) {
                        params.color = '#E8A408';
                        params.status = 'ignored passed';
                        console.log(colors.yellow(`* ignore ${params.group} ${params.test} (${params.ignored})`));
                    } else if (!params.ok) {
                        params.color = 'red';
                        params.status = 'failed';
                        console.log(colors.red(`* failed ${params.group} ${params.test}`));
                    } else {
                        params.color = 'green';
                        params.status = 'passed';
                        console.log(colors.green(`* passed ${params.group} ${params.test}`));
                    }

                    callback(null, params);
                });
            });
        });
    });

    q.defer(server.close);

    q.awaitAll((err, results) => {
        if (err) {
            console.error(err);
            setTimeout(() => { process.exit(-1); }, 0);
            return;
        }

        results = results.slice(1, -1);

        if (process.env.UPDATE) {
            console.log(`Updated ${results.length} tests.`);
            process.exit(0);
        }

        let passedCount = 0,
            ignoreCount = 0,
            ignorePassCount = 0,
            failedCount = 0;

        results.forEach((params) => {
            if (params.ignored && !params.ok) {
                ignoreCount++;
            } else if (params.ignored) {
                ignorePassCount++;
            } else if (!params.ok) {
                failedCount++;
            } else {
                passedCount++;
            }
        });

        const totalCount = passedCount + ignorePassCount + ignoreCount + failedCount;

        if (passedCount > 0) {
            console.log(colors.green('%d passed (%s%)'),
                passedCount, (100 * passedCount / totalCount).toFixed(1));
        }

        if (ignorePassCount > 0) {
            console.log(colors.yellow('%d passed but were ignored (%s%)'),
                ignorePassCount, (100 * ignorePassCount / totalCount).toFixed(1));
        }

        if (ignoreCount > 0) {
            console.log(colors.white('%d ignored (%s%)'),
                ignoreCount, (100 * ignoreCount / totalCount).toFixed(1));
        }

        if (failedCount > 0) {
            console.log(colors.red('%d failed (%s%)'),
                failedCount, (100 * failedCount / totalCount).toFixed(1));
        }

        const resultsTemplate = template(fs.readFileSync(path.join(__dirname, '..', 'results.html.tmpl'), 'utf8'));
        const itemTemplate = template(fs.readFileSync(path.join(directory, 'result_item.html.tmpl'), 'utf8'));

        const failed = results.filter(r => /failed/.test(r.status));
        const [pre, post] = resultsTemplate({ failed })
            .split('<!-- results go here -->');

        const p = path.join(directory, 'index.html');
        const out = fs.createWriteStream(p);

        const q = queue(1);
        q.defer(write, out, pre);
        for (const r of results) {
            q.defer(write, out, itemTemplate({ r, hasFailedTests: failed.length > 0 }));
        }
        q.defer(write, out, post);
        q.await(() => {
            out.end();
            out.on('close', () => {
                console.log(`Results at: ${p}`);
                process.exit(failedCount === 0 ? 0 : 1);
            });
        });
    });
};

function write(stream, data, cb) {
    if (!stream.write(data)) {
        stream.once('drain', cb);
    } else {
        process.nextTick(cb);
    }
}
