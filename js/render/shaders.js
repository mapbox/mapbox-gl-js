'use strict';

var fs = require('fs');
var path = require('path');

// Must be written out long-form for brfs.
module.exports = {
    debug: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/debug.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/debug.vertex.glsl'), 'utf8')
    },
    fill: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/fill.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/fill.vertex.glsl'), 'utf8')
    },
    circle: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/circle.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/circle.vertex.glsl'), 'utf8')
    },
    line: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/line.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/line.vertex.glsl'), 'utf8')
    },
    linepattern: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/linepattern.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/linepattern.vertex.glsl'), 'utf8')
    },
    linesdfpattern: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/linesdfpattern.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/linesdfpattern.vertex.glsl'), 'utf8')
    },
    outline: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/outline.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/outline.vertex.glsl'), 'utf8')
    },
    pattern: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/pattern.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/pattern.vertex.glsl'), 'utf8')
    },
    raster: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/raster.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/raster.vertex.glsl'), 'utf8')
    },
    icon: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/icon.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/icon.vertex.glsl'), 'utf8')
    },
    sdf: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/sdf.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/sdf.vertex.glsl'), 'utf8')
    },
    collisionbox: {
        fragment: fs.readFileSync(path.join(__dirname, '../../shaders/collisionbox.fragment.glsl'), 'utf8'),
        vertex: fs.readFileSync(path.join(__dirname, '../../shaders/collisionbox.vertex.glsl'), 'utf8')
    }
};
