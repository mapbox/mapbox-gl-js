import path from 'path';
import fs from 'fs';
import diff from 'diff';
import {PNG} from 'pngjs';
import harness from './harness';

function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number')
        return Math.abs(a - b) < 1e-10;
    if (a === null || typeof a !== 'object')
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
 * Run the query suite.
 *
 * @param {string} implementation - identify the implementation under test; used to
 * deal with implementation-specific test exclusions and fudge-factors
 * @param {Object} options
 * @param {Array<string>} [options.tests] - array of test names to run; tests not in the
 * array will be skipped
 * @param {queryFn} query - a function that performs the query
 * @returns {undefined} terminates the process when testing is complete
 */
export function run(implementation, options, query) {
    const directory = path.join(__dirname, '../query-tests');
    harness(directory, implementation, options, (style, params, done) => {
        query(style, params, (err, data, results) => {
            if (err) return done(err);

            const dir = path.join(directory, params.id);

            if (process.env.UPDATE) {
                fs.writeFile(path.join(dir, 'expected.json'), JSON.stringify(results, null, 2), done);
                return;
            }

            const expected = require(path.join(dir, 'expected.json'));

            //For feature states, remove 'state' from fixtures until implemented in native https://github.com/mapbox/mapbox-gl-native/issues/11846
            if (implementation === 'native') {
                for (let i = 0; i < expected.length; i++) {
                    delete expected[i].state;
                    delete expected[i].source;
                    delete expected[i].sourceLayer;
                }
            }
            params.ok = deepEqual(results, expected);

            if (!params.ok) {
                const msg = diff.diffJson(expected, results)
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

                params.difference = msg;
                console.log(msg);
            }

            const width = params.width * params.pixelRatio;
            const height = params.height * params.pixelRatio;

            const color = [255, 0, 0, 255];

            function scaleByPixelRatio(x) {
                return x * params.pixelRatio;
            }

            if (!Array.isArray(params.queryGeometry[0])) {
                const p = params.queryGeometry.map(scaleByPixelRatio);
                const d = 30;
                drawAxisAlignedLine([p[0] - d, p[1]], [p[0] + d, p[1]], data, width, height, color);
                drawAxisAlignedLine([p[0], p[1] - d], [p[0], p[1] + d], data, width, height, color);
            } else {
                const a = params.queryGeometry[0].map(scaleByPixelRatio);
                const b = params.queryGeometry[1].map(scaleByPixelRatio);
                drawAxisAlignedLine([a[0], a[1]], [a[0], b[1]], data, width, height, color);
                drawAxisAlignedLine([a[0], b[1]], [b[0], b[1]], data, width, height, color);
                drawAxisAlignedLine([b[0], b[1]], [b[0], a[1]], data, width, height, color);
                drawAxisAlignedLine([b[0], a[1]], [a[0], a[1]], data, width, height, color);
            }

            const actualJSON = path.join(dir, 'actual.json');
            fs.writeFile(actualJSON, JSON.stringify(results, null, 2), () => {});

            const actualPNG = path.join(dir, 'actual.png');

            const png = new PNG({
                width: params.width * params.pixelRatio,
                height: params.height * params.pixelRatio
            });

            png.data = data;

            png.pack()
                .pipe(fs.createWriteStream(actualPNG))
                .on('finish', () => {
                    params.actual = fs.readFileSync(actualPNG).toString('base64');
                    done();
                });
        });
    });
}

function drawAxisAlignedLine(a, b, pixels, width, height, color) {
    const fromX = clamp(Math.min(a[0], b[0]), 0, width);
    const toX = clamp(Math.max(a[0], b[0]), 0, width);
    const fromY = clamp(Math.min(a[1], b[1]), 0, height);
    const toY = clamp(Math.max(a[1], b[1]), 0, height);

    let index;
    if (fromX === toX) {
        for (let y = fromY; y <= toY; y++) {
            index = getIndex(fromX, y);
            pixels[index + 0] = color[0];
            pixels[index + 1] = color[1];
            pixels[index + 2] = color[2];
            pixels[index + 3] = color[3];
        }
    } else {
        for (let x = fromX; x <= toX; x++) {
            index = getIndex(x, fromY);
            pixels[index + 0] = color[0];
            pixels[index + 1] = color[1];
            pixels[index + 2] = color[2];
            pixels[index + 3] = color[3];
        }
    }

    function getIndex(x, y) {
        return (y * width + x) * 4;
    }
}

function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
}
