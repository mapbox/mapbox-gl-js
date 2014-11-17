'use strict';

/* jshint node:true */

var test = require('tape');
var PNG = require('pngjs').PNG;
var fs = require('fs');
var st = require('st');
var path = require('path');
var http = require('http');
var mkdirp = require('mkdirp');

require('./bootstrap');

var Map = require('../js/ui/map');
var browser = require('../js/util/browser');

var suitePath = path.dirname(require.resolve('mapbox-gl-test-suite/package.json')),
    server = http.createServer(st({path: suitePath}));

test('before render', function(t) {
    server.listen(2900, t.end);
});

function renderTest(style, info, dir) {
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
            interactive: false,
            attributionControl: false
        });

        map.style.setClassList(info.classes || [], {transition: false});

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

        map.on('render', rendered);

        var watchdog = setTimeout(function() {
            t.fail('timed out after 4 seconds');
        }, 4000);

        t.once('end', function() {
            clearTimeout(watchdog);
        });

        function rendered() {
            for (var id in map.sources)
                if (!map.sources[id].loaded())
                    return;
            if (map.style.sprite && !map.style.sprite.loaded())
                return;

            map.off('render', rendered);

            var w = width * browser.devicePixelRatio,
                h = height * browser.devicePixelRatio;

            var png = new PNG({width: w, height: h});

            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, png.data);

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

            png.pack()
                .pipe(fs.createWriteStream(path.join(dir, process.env.UPDATE ? 'expected.png' : 'actual.png')))
                .on('finish', t.end);
        }
    };
}

fs.readdirSync(path.join(suitePath, 'tests')).forEach(function(dir) {
    if (dir === 'index.html') return;

    var style = require(path.join(suitePath, 'tests', dir, 'style.json')),
        info  = require(path.join(suitePath, 'tests', dir, 'info.json'));

    for (var k in style.sources) {
        var source = style.sources[k];

        for (var l in source.tiles) {
            source.tiles[l] = source.tiles[l].replace(/^local:\/\//, 'http://localhost:2900/');
        }

        if (source.url) {
            source.url = source.url.replace(/^local:\/\//, 'http://localhost:2900/');
        }
    }

    if (style.sprite) {
        style.sprite = style.sprite.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    if (style.glyphs) {
        style.glyphs = style.glyphs.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    for (k in info) {
        (info[k].js === false ? test.skip : test)(dir + ' ' + k, renderTest(style, info[k], path.join(suitePath, 'tests', dir, k)));
    }
});

test('after render', function(t) {
    server.close(t.end);
});
