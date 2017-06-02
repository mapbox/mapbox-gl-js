'use strict';

const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const harness = require('./harness');
const pixelmatch = require('pixelmatch');

function compare(path1, path2, diffPath, callback) {

    const img1 = fs.createReadStream(path1).pipe(new PNG()).on('parsed', doneReading);
    const img2 = fs.createReadStream(path2).pipe(new PNG()).on('parsed', doneReading);
    let read = 0;

    function doneReading() {
        if (++read < 2) return;

        const diff = new PNG({width: img1.width, height: img1.height});

        const numPixels = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {
            threshold: 0.13
        });

        diff.pack().pipe(fs.createWriteStream(diffPath)).on('finish', () => {
            callback(null, numPixels / (diff.width * diff.height));
        });
    }
}

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
 * @param {Object} options
 * @param {Array<string>} [options.tests] - array of test names to run; tests not in the
 * array will be skipped. Test names can be the name of a group, or the name of a group and the name
 * of an individual test, separated by a slash.
 * @param {renderFn} render - a function that performs the rendering
 * @returns {undefined} terminates the process when testing is complete
 */
exports.run = function (implementation, options, render) {
    const directory = path.join(__dirname, '../render-tests');
    harness(directory, implementation, options, (style, params, done) => {
        render(style, params, (err, data) => {
            if (err) return done(err);

            let stats;
            const dir = path.join(directory, params.group, params.test);
            try {
                stats = fs.statSync(dir, fs.R_OK | fs.W_OK);
                if (!stats.isDirectory()) throw new Error();
            }            catch (e) {
                fs.mkdirSync(dir);
            }

            const expected = path.join(dir, 'expected.png');
            const actual   = path.join(dir, 'actual.png');
            const diff     = path.join(dir, 'diff.png');

            const png = new PNG({
                width: params.width * params.pixelRatio,
                height: params.height * params.pixelRatio
            });

            png.data = data;

            if (process.env.UPDATE) {
                png.pack()
                    .pipe(fs.createWriteStream(expected))
                    .on('finish', done);
            } else {
                png.pack()
                    .pipe(fs.createWriteStream(actual))
                    .on('finish', () => {

                        try {
                            stats = fs.statSync(expected, fs.R_OK | fs.W_OK);
                            if (!stats.isFile()) throw new Error();
                        }                        catch (e) {  // no expected.png, create it
                            png.pack()
                                .pipe(fs.createWriteStream(expected))
                                .on('finish', done);
                            return;
                        }

                        compare(actual, expected, diff, (err, difference) => {
                            if (err) return done(err);

                            params.difference = difference;
                            params.ok = difference <= params.allowed;

                            params.actual = fs.readFileSync(actual).toString('base64');
                            params.expected = fs.readFileSync(expected).toString('base64');
                            params.diff = fs.readFileSync(diff).toString('base64');

                            done();
                        });
                    });
            }
        });
    });
};

/**
 * @callback renderFn
 * @param {Object} style - style to render
 * @param {Object} options
 * @param {number} options.width - render this wide
 * @param {number} options.height - render this high
 * @param {number} options.pixelRatio - render with this pixel ratio
 * @param {renderCallback} callback - callback to call with the results of rendering
 */

/**
 * @callback renderCallback
 * @param {?Error} error
 * @param {Buffer} [result] - raw RGBA image data
 */
