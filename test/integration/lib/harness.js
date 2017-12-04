'use strict';

/* eslint-disable no-process-exit */

const fs = require('fs');
const path = require('path');
const queue = require('d3-queue').queue;
const colors = require('colors/safe');
const template = require('lodash').template;
const shuffler = require('shuffle-seed');

module.exports = function (directory, implementation, options, run) {
    const q = queue(1);
    const server = require('./server')();

    const tests = options.tests || [];
    const ignores = options.ignores || {};

    const available = [];
    const fixtureFilename = options.fixtureFilename || 'style.json';

    fs.readdirSync(directory).forEach((group) => {
        if (
            group === 'index.html' ||
            group === 'index-recycle-map.html' ||
            group === 'results.html.tmpl' ||
            group === 'result_item.html.tmpl' ||
            group[0] === '.'
        ) {
            return;
        }

        fs.readdirSync(path.join(directory, group)).forEach((test) => {
            if (test[0] === '.')
                return;

            available.push({ group: group, test: test });
        });
    });

    let sequence = [];

    function shouldRunTest(group, test) {
        try {
            if (!fs.lstatSync(path.join(directory, group, test)).isDirectory())
                return false;
            if (!fs.lstatSync(path.join(directory, group, test, fixtureFilename)).isFile())
                return false;
        } catch (err) {
            console.log(colors.blue(`* omitting ${group} ${test} due to missing ${fixtureFilename}`));
            return false;
        }

        if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && group === 'debug') {
            console.log(colors.gray(`* skipped ${group} ${test}`));
            return false;
        }

        const id = `${path.basename(directory)}/${group}/${test}`;
        const ignored = ignores[id];
        if (/^skip/.test(ignored)) {
            console.log(colors.gray(`* skipped ${group} ${test} (${ignored})`));
            return false;
        }

        return true;
    }

    function addTestToSequence(group, test) {
        // Skip ignored and malformed tests.
        if (!shouldRunTest(group, test)) return;

        const style = require(path.join(directory, group, test, fixtureFilename));

        server.localizeURLs(style);

        const id = `${path.basename(directory)}/${group}/${test}`;
        const ignored = ignores[id];

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

        sequence.push({ style: style, params: params });
    }

    if (tests.length) {
        tests.forEach((test) => {
            available.forEach((availableTest) => {
                if (`${availableTest.group}/${availableTest.test}`.indexOf(test) !== -1) {
                    let unique = true;
                    // Avoid duplicates in the test sequence.
                    sequence.forEach((checkedTest) => {
                        if (checkedTest.params.group === availableTest.group && checkedTest.params.test === availableTest.test) {
                            unique = false;
                            return;
                        }
                    });
                    if (unique) {
                        addTestToSequence(availableTest.group, availableTest.test);
                    }
                }
            });
        });
    } else {
        // No specific test requested, run all available.
        available.forEach((availableTest) => {
            addTestToSequence(availableTest.group, availableTest.test);
        });
    }


    if (options.shuffle) {
        console.log(colors.white(`* shuffle seed: `) + colors.bold(`${options.seed}`));
        sequence = shuffler.shuffle(sequence, options.seed);
    }

    q.defer(server.listen);

    sequence.forEach((test) => {
        q.defer((callback) => {
            run(test.style, test.params, (err) => {
                if (err) return callback(err);

                if (test.params.ignored && !test.params.ok) {
                    test.params.color = '#9E9E9E';
                    test.params.status = 'ignored failed';
                    console.log(colors.white(`* ignore ${test.params.group} ${test.params.test} (${test.params.ignored})`));
                } else if (test.params.ignored) {
                    test.params.color = '#E8A408';
                    test.params.status = 'ignored passed';
                    console.log(colors.yellow(`* ignore ${test.params.group} ${test.params.test} (${test.params.ignored})`));
                } else if (!test.params.ok) {
                    test.params.color = 'red';
                    test.params.status = 'failed';
                    console.log(colors.red(`* failed ${test.params.group} ${test.params.test}`));
                } else {
                    test.params.color = 'green';
                    test.params.status = 'passed';
                    console.log(colors.green(`* passed ${test.params.group} ${test.params.test}`));
                }

                callback(null, test.params);
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

        const failed = results.filter(r => r.status === 'failed');

        const resultsShell = resultsTemplate({ failed, sequence, shuffle: options.shuffle, seed: options.seed })
            .split('<!-- results go here -->');

        const p = path.join(directory, options.recycleMap ? 'index-recycle-map.html' : 'index.html');
        const out = fs.createWriteStream(p);

        const q = queue(1);
        q.defer(write, out, resultsShell[0]);
        for (const r of results) {
            q.defer(write, out, itemTemplate({ r, hasFailedTests: failed.length > 0 }));
        }
        q.defer(write, out, resultsShell[1]);
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
