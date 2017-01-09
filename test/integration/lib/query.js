var path = require('path');
var harness = require('./harness');
var diff = require('diff');
var PNG = require('pngjs').PNG;
var fs = require('fs');

function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number')
        return Math.abs(a - b) < 1e-10;
    if (a === null || typeof a !== 'object')
        return a === b;

    var ka = Object.keys(a);
    var kb = Object.keys(b);

    if (ka.length != kb.length)
        return false;

    ka.sort();
    kb.sort();

    for (var i = 0; i < ka.length; i++)
        if (ka[i] != kb[i] || !deepEqual(a[ka[i]], b[ka[i]]))
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
exports.run = function (implementation, options, query) {
    var directory = path.join(__dirname, '../query-tests');
    harness(directory, implementation, options, function(style, params, done) {
        query(style, params, function(err, data, results) {
            if (err) return done(err);

            var dir = path.join(directory, params.group, params.test);

            if (process.env.UPDATE) {
                fs.writeFile(path.join(dir, 'expected.json'), JSON.stringify(results, null, 2), done);
                return;
            }

            var expected = require(path.join(dir, 'expected.json'));
            params.ok = deepEqual(results, expected);

            if (!params.ok) {
                var msg = diff.diffJson(expected, results)
                    .map(function (hunk) {
                        if (hunk.added) {
                            return '+ ' + hunk.value;
                        } else if (hunk.removed) {
                            return '- ' + hunk.value;
                        } else {
                            return '  ' + hunk.value;
                        }
                    })
                    .join('');

                params.difference = msg;
                console.log(msg);
            }

            var width = params.width * params.pixelRatio;
            var height = params.height * params.pixelRatio;
            var x, y;

            var color = [255, 0, 0, 255];

            function scaleByPixelRatio(x) {
                return x * params.pixelRatio;
            }

            if (!Array.isArray(params.queryGeometry[0])) {
                var p = params.queryGeometry.map(scaleByPixelRatio);
                var d = 30;
                drawAxisAlignedLine([p[0] - d, p[1]], [p[0] + d, p[1]], data, width, height, color);
                drawAxisAlignedLine([p[0], p[1] - d], [p[0], p[1] + d], data, width, height, color);
            } else {
                var a = params.queryGeometry[0].map(scaleByPixelRatio);
                var b = params.queryGeometry[1].map(scaleByPixelRatio);
                drawAxisAlignedLine([a[0], a[1]], [a[0], b[1]], data, width, height, color);
                drawAxisAlignedLine([a[0], b[1]], [b[0], b[1]], data, width, height, color);
                drawAxisAlignedLine([b[0], b[1]], [b[0], a[1]], data, width, height, color);
                drawAxisAlignedLine([b[0], a[1]], [a[0], a[1]], data, width, height, color);
            }

            var actual = path.join(dir, 'actual.png');

            var png = new PNG({
                width: params.width * params.pixelRatio,
                height: params.height * params.pixelRatio
            });

            png.data = data;

            png.pack()
                .pipe(fs.createWriteStream(actual))
                .on('finish', function() {
                    params.actual = fs.readFileSync(actual).toString('base64');
                    done();
                });
        });
    });
};

function drawAxisAlignedLine(a, b, pixels, width, height, color) {
    var fromX = clamp(Math.min(a[0], b[0]), 0, width);
    var toX = clamp(Math.max(a[0], b[0]), 0, width);
    var fromY = clamp(Math.min(a[1], b[1]), 0, height);
    var toY = clamp(Math.max(a[1], b[1]), 0, height);

    var index;
    if (fromX === toX) {
        for (var y = fromY; y <= toY; y++) {
            index = getIndex(fromX, y);
            pixels[index + 0] = color[0];
            pixels[index + 1] = color[1];
            pixels[index + 2] = color[2];
            pixels[index + 3] = color[3];
        }
    } else {
        for (var x = fromX; x <= toX; x++) {
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
