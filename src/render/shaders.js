'use strict';

const fs = require('fs');
const path = require('path');

// readFileSync calls must be written out long-form for brfs.
module.exports = {
    prelude: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/_prelude.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/_prelude.vertex.glsl'), 'utf8')
    },
    circle: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/circle.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/circle.vertex.glsl'), 'utf8')
    },
    collisionBox: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/collision_box.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/collision_box.vertex.glsl'), 'utf8')
    },
    debug: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/debug.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/debug.vertex.glsl'), 'utf8')
    },
    fill: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/fill.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/fill.vertex.glsl'), 'utf8')
    },
    fillOutline: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_outline.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_outline.vertex.glsl'), 'utf8')
    },
    fillOutlinePattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_outline_pattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_outline_pattern.vertex.glsl'), 'utf8')
    },
    fillPattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_pattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_pattern.vertex.glsl'), 'utf8')
    },
    fillExtrusion: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_extrusion.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_extrusion.vertex.glsl'), 'utf8')
    },
    fillExtrusionPattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_extrusion_pattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/fill_extrusion_pattern.vertex.glsl'), 'utf8')
    },
    extrusionTexture: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/extrusion_texture.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/extrusion_texture.vertex.glsl'), 'utf8')
    },
    line: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/line.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/line.vertex.glsl'), 'utf8')
    },
    linePattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/line_pattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/line_pattern.vertex.glsl'), 'utf8')
    },
    lineSDF: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/line_sdf.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/line_sdf.vertex.glsl'), 'utf8')
    },
    raster: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/raster.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/raster.vertex.glsl'), 'utf8')
    },
    symbolIcon: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/symbol_icon.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/symbol_icon.vertex.glsl'), 'utf8')
    },
    symbolSDF: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../shaders/symbol_sdf.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../shaders/symbol_sdf.vertex.glsl'), 'utf8')
    }
};
