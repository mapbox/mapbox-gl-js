'use strict';

var test = require('tape').test;
var Map = require('../js/ui/map.js');
var Source = require('../js/ui/source.js');
var PNG = require('png').Png;
var fs = require('fs');
var st = require('st');
var path = require('path');
var http = require('http');
var mapnik = require('mapnik');

var suitePath = path.dirname(require.resolve('mapbox-gl-test-suite/package.json')),
    server = http.createServer(st({path: suitePath}));

function imageEqualsFile(buffer, fixture, callback) {
    var expectImage = new mapnik.Image.open(fixture);
    var resultImage = new mapnik.Image.fromBytesSync(buffer);

    // Allow < 2% of pixels to vary by > default comparison threshold of 16.
    var pxThresh = resultImage.width() * resultImage.height() * 0.02;
    var pxDiff = expectImage.compare(resultImage);

    if (pxDiff > pxThresh) {
        callback(new Error('Image is too different from fixture: ' + pxDiff + ' pixels > ' + pxThresh + ' pixels'));
    } else {
        callback();
    }
}

Source.protocols["local"] = function(url, callback) {
    var id = url.split('://')[1];
    callback(null, {
        minzoom: 0,
        maxzoom: 18,
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
            center: info.center,
            zoom: info.zoom,
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
                var expected = path.join(dir, 'expected.png'),
                    actual   = path.join(dir, 'actual.png');
                fs.writeFileSync(actual, data);
                t.end();
//                imageEqualsFile(data, expected, t.end);
            });
        }
    }
}

fs.readdirSync(path.join(suitePath, 'tests')).forEach(function(dir) {
    if (dir === 'index.html') return;

    var style = require(path.join(suitePath, 'tests', dir, 'style.json')),
        info  = require(path.join(suitePath, 'tests', dir, 'info.json'));

    for (var k in info) {
        test(dir + ' ' + k, renderTest(style, info[k], path.join(suitePath, 'tests', dir, k)));
    }
});

test('after render', function(t) {
    server.close(t.end);
});
