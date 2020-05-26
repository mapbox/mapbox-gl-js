import path from 'path';
import fs from 'fs';
import {PNG} from 'pngjs';
import harness from './harness';
import pixelmatch from 'pixelmatch';
import * as glob from 'glob';

/**
 * Run the render test suite, compute differences to expected values (making exceptions based on
 * implementation vagaries), print results to standard output, write test artifacts to the
 * filesystem (optionally updating expected results), and exit the process with a success or
 * failure code.
 *
 * Caller must supply a `render` function that does the actual rendering and passes the raw image
 * result on to the `render` function's callback.
 *
 * A local server is launched that is capable of serving requests for the source, sprite,
 * font, and tile assets needed by the tests, and the URLs within the test styles are
 * rewritten to point to that server.
 *
 * As the tests run, results are printed to standard output, and test artifacts are written
 * to the filesystem. If the environment variable `UPDATE` is set, the expected artifacts are
 * updated in place based on the test rendering.
 *
 * If all the tests are successful, this function exits the process with exit code 0. Otherwise
 * it exits with 1. If an unexpected error occurs, it exits with -1.
 *
 * @param {string} implementation - identify the implementation under test; used to
 * deal with implementation-specific test exclusions and fudge-factors
 * @param {Object<string>} [ignores] - map of test names to disable. A key is the relative
 * path to a test directory, e.g. `"render-tests/background-color/default"`. A value is a string
 * that by convention links to an issue that explains why the test is currently disabled. By default,
 * disabled tests will be run, but not fail the test run if the result does not match the expected
 * result. If the value begins with "skip", the test will not be run at all -- use this for tests
 * that would crash the test harness entirely if they were run.
 * @param {renderFn} render - a function that performs the rendering
 * @returns {undefined} terminates the process when testing is complete
 */
export function run(implementation, ignores, render) {
    const options = {ignores, tests:[], shuffle:false, recycleMap:false, seed:makeHash()};

    // https://stackoverflow.com/a/1349426/229714
    function makeHash() {
        const array = [];
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (let i = 0; i < 10; ++i)
            array.push(possible.charAt(Math.floor(Math.random() * possible.length)));

        // join array elements without commas.
        return array.join('');
    }

    function checkParameter(param) {
        const index = options.tests.indexOf(param);
        if (index === -1)
            return false;
        options.tests.splice(index, 1);
        return true;
    }

    function checkValueParameter(defaultValue, param) {
        const index = options.tests.findIndex((elem) => { return String(elem).startsWith(param); });
        if (index === -1)
            return defaultValue;

        const split = String(options.tests.splice(index, 1)).split('=');
        if (split.length !== 2)
            return defaultValue;

        return split[1];
    }

    if (process.argv.length > 2) {
        options.tests = process.argv.slice(2).filter((value, index, self) => { return self.indexOf(value) === index; }) || [];
        options.shuffle = checkParameter('--shuffle');
        options.recycleMap = checkParameter('--recycle-map');
        options.seed = checkValueParameter(options.seed, '--seed');
    }

    const directory = path.join(__dirname, '../render-tests');
    harness(directory, implementation, options, (style, params, done) => {
        render(style, params, (err, data) => {
            if (err) return done(err);

            let stats;
            const dir = path.join(directory, params.id);
            try {
                stats = fs.statSync(dir, fs.R_OK | fs.W_OK);
                if (!stats.isDirectory()) throw new Error();
            } catch (e) {
                fs.mkdirSync(dir);
            }

            const expectedPath = path.join(dir, 'expected.png');
            const actualPath = path.join(dir, 'actual.png');
            const diffPath = path.join(dir, 'diff.png');

            const width = Math.floor(params.width * params.pixelRatio);
            const height = Math.floor(params.height * params.pixelRatio);
            const actualImg = new PNG({width, height});

            // PNG data must be unassociated (not premultiplied)
            for (let i = 0; i < data.length; i++) {
                const a = data[i * 4 + 3] / 255;
                if (a !== 0) {
                    data[i * 4 + 0] /= a;
                    data[i * 4 + 1] /= a;
                    data[i * 4 + 2] /= a;
                }
            }
            actualImg.data = data;

            // there may be multiple expected images, covering different platforms
            const expectedPaths = glob.sync(path.join(dir, 'expected*.png'));

            if (!process.env.UPDATE && expectedPaths.length === 0) {
                throw new Error('No expected*.png files found; did you mean to run tests with UPDATE=true?');
            }

            if (process.env.UPDATE) {
                fs.writeFileSync(expectedPath, PNG.sync.write(actualImg));

            } else {
                // if we have multiple expected images, we'll compare against each one and pick the one with
                // the least amount of difference; this is useful for covering features that render differently
                // depending on platform, i.e. heatmaps use half-float textures for improved rendering where supported
                let minDiff = Infinity;
                let minDiffImg, minExpectedBuf;

                for (const path of expectedPaths) {
                    const expectedBuf = fs.readFileSync(path);
                    const expectedImg = PNG.sync.read(expectedBuf);
                    const diffImg = new PNG({width, height});

                    const diff = pixelmatch(
                        actualImg.data, expectedImg.data, diffImg.data,
                        width, height, {threshold: 0.1285}) / (width * height);

                    if (diff < minDiff) {
                        minDiff = diff;
                        minDiffImg = diffImg;
                        minExpectedBuf = expectedBuf;
                    }
                }

                const diffBuf = PNG.sync.write(minDiffImg, {filterType: 4});
                const actualBuf = PNG.sync.write(actualImg, {filterType: 4});

                fs.writeFileSync(diffPath, diffBuf);
                fs.writeFileSync(actualPath, actualBuf);

                params.difference = minDiff;
                params.ok = minDiff <= params.allowed;

                params.actual = actualBuf.toString('base64');
                params.expected = minExpectedBuf.toString('base64');
                params.diff = diffBuf.toString('base64');
            }

            done();
        });
    });
}

/**
 * @callback renderFn
 * @param {Object} style - style to render
 * @param {Object} options
 * @param {number} options.width - render this wide
 * @param {number} options.height - render this high
 * @param {number} options.pixelRatio - render with this pixel ratio
 * @param {boolean} options.shuffle - shuffle tests sequence
 * @param {String} options.seed - Shuffle seed
 * @param {boolean} options.recycleMap - trigger map object recycling
 * @param {renderCallback} callback - callback to call with the results of rendering
 */

/**
 * @callback renderCallback
 * @param {?Error} error
 * @param {Buffer} [result] - raw RGBA image data
 */
