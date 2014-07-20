'use strict';

var test = require('tape').test;
var Map = require('../js/ui/map.js');
var Source = require('../js/ui/source.js');
var PNG = require('png').Png;
var fs = require('fs');
var st = require('st');
var path = require('path');
var http = require('http');
var mkdirp = require('mkdirp');

var suitePath = path.dirname(require.resolve('mapbox-gl-test-suite/package.json')),
    server = http.createServer(st({path: suitePath}));

Source.protocols["local"] = function(url, callback) {
    var id = url.split('://')[1];
    callback(null, {
        minzoom: 0,
        maxzoom: 14,
        tiles: ['http://localhost:2900/' + id]
    });
};

test('before render', function(t) {
    server.listen(2900, t.end);
});

function renderTest(style, info, dir) {
    return function (t) {
        var width = info.width || 512,
            height = info.height || 512;

        var map = new Map({
            container: {
                offsetWidth: width,
                offsetHeight: height
            },
            center: info.center || [0, 0],
            zoom: info.zoom || 0,
            bearing: info.bearing || 0,
            style: style,
            interactive: false
        });

        map.style.setClassList(info.classes || [], {transition: false});

        var gl = map.painter.gl;

        map.painter.bindRenderTexture = function(name) {
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

        map.on('render', rendered);

        function rendered() {
            if (!map.sources['mapbox'].loaded())
                return;
            if (map.style.sprite && !map.style.sprite.loaded())
                return;

            map.off('render', rendered);

            var pixels = new Buffer(width * height * 3);
            gl.readPixels(0, 0, width, height, gl.RGB, gl.UNSIGNED_BYTE, pixels);

            // Flip the scanlines.
            var stride = width * 3;
            var tmp = new Buffer(stride);
            for (var i = 0, j = height - 1; i < j; i++, j--) {
                var start = i * stride;
                var end = j * stride;
                pixels.copy(tmp, 0, start, start + stride);
                pixels.copy(pixels, start, end, end + stride);
                tmp.copy(pixels, end);
            }

            var png = new PNG(pixels, width, height, 'rgb');
            png.encode(function(data) {
                if (process.env.UPDATE) {
                    mkdirp.sync(dir);
                    fs.writeFile(path.join(dir, 'expected.png'), data, t.end);
                } else {
                    fs.writeFile(path.join(dir, 'actual.png'), data, t.end);
                }
            });
        }
    }
}

fs.readdirSync(path.join(suitePath, 'tests')).forEach(function(dir) {
    if (dir === 'index.html') return;

    var style = require(path.join(suitePath, 'tests', dir, 'style.json')),
        info  = require(path.join(suitePath, 'tests', dir, 'info.json'));

    if (style.sprite) {
        style.sprite = style.sprite.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    for (var k in info) {
        (info[k].js === false ? test.skip : test)(dir + ' ' + k, renderTest(style, info[k], path.join(suitePath, 'tests', dir, k)));
    }
});

test('after render', function(t) {
    server.close(t.end);
});
