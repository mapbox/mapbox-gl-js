'use strict';

/* jshint node:true */

var test = require('tape');
var PNG = require('pngjs').PNG;
var fs = require('fs');
var st = require('st');
var path = require('path');
var http = require('http');
var mkdirp = require('mkdirp');
var spawn = require('child_process').spawn;
var Map = require('../js/ui/map');
var browser = require('../js/util/browser');

var suitePath = path.dirname(require.resolve('mapbox-gl-test-suite/package.json')),
    server = http.createServer(st({path: suitePath}));

function template(name) {
    return fs.readFileSync(require.resolve('mapbox-gl-test-suite/templates/' + name + '.html.tmpl')).toString();
}

var results = '';
var resultTemplate = template('result');

function format(tmpl, kwargs) {
    return tmpl.replace(/\{\{|\}\}|\{([^}]+)\}/g, function(match, key) {
        if (match === '{{') return '{';
        if (match === '}}') return '}';
        return kwargs[key];
    });
}

test('before render', function(t) {
    server.listen(2900, t.end);
});

function renderTest(style, info, base, key) {
    var dir = path.join(suitePath, 'tests', base, key);
    return function (t) {
        browser.devicePixelRatio = info.pixelRatio || 1;

        var width = info.width || 512,
            height = info.height || 512;

        var map = new Map({
            container: {
                offsetWidth: width,
                offsetHeight: height,
                classList: {
                    add: function() {}
                }
            },
            center: info.center || [0, 0],
            zoom: info.zoom || 0,
            bearing: info.bearing || 0,
            style: style,
            classes: info.classes || [],
            interactive: false,
            attributionControl: false
        });

        var gl = map.painter.gl;

        map.painter.prepareBuffers = function() {
            var gl = this.gl;

            if (!gl.renderbuffer) {
                // Create default renderbuffer
                gl.renderbuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, gl.renderbuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight);
            }

            if (!gl.stencilbuffer) {
                // Create default stencilbuffer
                gl.stencilbuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, gl.stencilbuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, gl.drawingBufferWidth, gl.drawingBufferHeight);
            }

            if (!gl.framebuffer) {
                // Create frame buffer
                gl.framebuffer = gl.createFramebuffer();
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, gl.framebuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, gl.renderbuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, gl.stencilbuffer);

            this.clearColor();
        };

        map.painter.bindDefaultFramebuffer = function() {
            var gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, gl.framebuffer);
        };

        var watchdog = setTimeout(function() {
            t.fail('timed out after 20 seconds');
        }, 20000);

        t.once('end', function() {
            clearTimeout(watchdog);
        });

        map.once('load', function() {
            var w = width * browser.devicePixelRatio,
                h = height * browser.devicePixelRatio;

            var png = new PNG({width: w, height: h});

            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, png.data);

            map.remove();
            gl.destroy();

            // Flip the scanlines.
            var stride = w * 4;
            var tmp = new Buffer(stride);
            for (var i = 0, j = h - 1; i < j; i++, j--) {
                var start = i * stride;
                var end = j * stride;
                png.data.copy(tmp, 0, start, start + stride);
                png.data.copy(png.data, start, end, end + stride);
                tmp.copy(png.data, end);
            }

            mkdirp.sync(dir);

            var expected = path.join(dir, 'expected.png');
            var actual   = path.join(dir, 'actual.png');
            var diff     = path.join(dir, 'diff.png');

            if (process.env.UPDATE) {
                png.pack()
                    .pipe(fs.createWriteStream(expected))
                    .on('finish', t.end);
            } else {
                png.pack()
                    .pipe(fs.createWriteStream(actual))
                    .on('finish', function() {
                        var compare = spawn('compare', ['-metric', 'MAE', actual, expected, diff]);
                        var error = '';

                        compare.stderr.on('data', function (data) {
                            error += data.toString();
                        });

                        compare.on('exit', function (code) {
                            // The compare program returns 2 on error otherwise 0 if the images are similar or 1 if they are dissimilar.
                            if (code === 2) {
                                writeResult(error.trim(), Infinity);
                            } else {
                                var match = error.match(/^\d+(?:\.\d+)?\s+\(([^\)]+)\)\s*$/);
                                var difference = match ? parseFloat(match[1]) : Infinity;
                                writeResult(match ? '' : error, difference);
                            }
                        });

                        compare.stdin.end();

                        function writeResult(error, difference) {
                            var allowedDifference = ('diff' in info) ? info.diff : 0.001;
                            var color = difference <= allowedDifference ? 'green' : 'red';

                            results += format(resultTemplate, {
                                name: base,
                                key: key,
                                color: color,
                                error: error ? '<p>' + error + '</p>' : '',
                                difference: difference,
                                zoom: info.zoom || 0,
                                center: info.center || [0, 0],
                                bearing: info.bearing || 0,
                                width: info.width || 512,
                                height: info.height || 512
                            });

                            t.ok(difference <= allowedDifference);
                            t.end();
                        }
                    });
            }
        });
    };
}

var tests;

if (process.argv[1] === __filename) {
    tests = process.argv.slice(2);
}

fs.readdirSync(path.join(suitePath, 'tests')).forEach(function(dir) {
    if (dir === 'index.html' || dir[0] === '.') return;
    if (tests && tests.length && tests.indexOf(dir) < 0) return;

    var style = require(path.join(suitePath, 'tests', dir, 'style.json')),
        info  = require(path.join(suitePath, 'tests', dir, 'info.json'));

    function localURL(url) {
        return url.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    for (var k in style.sources) {
        var source = style.sources[k];

        for (var l in source.tiles) {
            source.tiles[l] = localURL(source.tiles[l]);
        }

        if (Array.isArray(source.url)) {
            source.url = source.url.map(localURL);
        } else if (source.url) {
            source.url = localURL(source.url);
        }
    }

    if (style.sprite) {
        style.sprite = localURL(style.sprite);
    }

    if (style.glyphs) {
        style.glyphs = localURL(style.glyphs);
    }

    for (k in info) {
        (info[k].js === false ? test.skip : test)(dir + ' ' + k, renderTest(style, info[k], dir, k));
    }
});

test('after render', function(t) {
    server.close(t.end);

    var p = path.join(suitePath, 'tests', 'index.html');
    fs.writeFileSync(p, format(template('results'), {results: results}));
    console.warn('Results at: ' + p);
});
