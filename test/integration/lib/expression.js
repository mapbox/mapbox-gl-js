'use strict';

const path = require('path');
const harness = require('./harness');
const diff = require('diff');
const fs = require('fs');

const linter = require('eslint').linter;

function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number')
        return Math.abs(a - b) < 1e-10;
    if (a === null || b === null || typeof a !== 'object')
        return a === b;

    const ka = Object.keys(a);
    const kb = Object.keys(b);

    if (ka.length !== kb.length)
        return false;

    ka.sort();
    kb.sort();

    for (let i = 0; i < ka.length; i++)
        if (ka[i] !== kb[i] || !deepEqual(a[ka[i]], b[ka[i]]))
            return false;

    return true;
}
/**
 * Run the expression suite.
 *
 * @param {string} implementation - identify the implementation under test; used to
 * deal with implementation-specific test exclusions and fudge-factors
 * @param {Object} options
 * @param {Array<string>} [options.tests] - array of test names to run; tests not in the
 * array will be skipped
 * @param {} runExpressionTest - a function that runs a single expression test fixture
 * @returns {undefined} terminates the process when testing is complete
 */
exports.run = function (implementation, options, runExpressionTest) {
    const directory = path.join(__dirname, '../expression-tests');
    options.fixtureFilename = 'test.json';
    harness(directory, implementation, options, (fixture, params, done) => {
        try {
            const result = runExpressionTest(fixture, params);
            const dir = path.join(directory, params.group, params.test);

            if (process.env.UPDATE) {
                delete result.compileResult.functionSource;
                fixture.expected = result;
                fs.writeFile(path.join(dir, 'test.json'), `${JSON.stringify(fixture, null, 2)}\n`, done);
                return;
            }

            const expected = fixture.expected;

            if (result.compileResult.functionSource) {
                params.compiledJs = result.compileResult.functionSource;
                delete result.compileResult.functionSource;
                const lint = linter.verify(params.compiledJs, {
                    parserOptions: { ecmaVersion: 5 }
                }).filter(message => message.fatal);
                if (lint.length > 0) {
                    result.compileResult.lintErrors = lint;
                }
            }

            const compileOk = deepEqual(result.compileResult, expected.compileResult);

            const evalOk = compileOk && deepEqual(result.evaluateResults, expected.evaluateResults);
            params.ok = compileOk && evalOk;

            let msg = '';
            if (!compileOk) {
                msg += diff.diffJson(expected.compileResult, result.compileResult)
                    .map((hunk) => {
                        if (hunk.added) {
                            return `+ ${hunk.value}`;
                        } else if (hunk.removed) {
                            return `- ${hunk.value}`;
                        } else {
                            return `  ${hunk.value}`;
                        }
                    })
                    .join('');
            }
            if (compileOk && !evalOk) {
                msg += expected.evaluateResults
                    .map((expectedOutput, i) => {
                        if (!deepEqual(expectedOutput, result.evaluateResults[i])) {
                            return `f(${JSON.stringify(fixture.evaluate[i])})\nExpected: ${JSON.stringify(expectedOutput)}\nActual: ${JSON.stringify(result.evaluateResults[i])}`;
                        }
                        return false;
                    })
                    .filter(Boolean)
                    .join('\n');
            }

            params.difference = msg;
            if (msg) { console.log(msg); }

            params.expression = JSON.stringify(fixture.expression, null, 2);

            done();
        } catch (e) {
            done(e);
        }
    });
};
