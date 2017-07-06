// @flow

const fs = require('fs');

// readFileSync calls must be written out long-form for brfs.
/* eslint-disable prefer-template, no-path-concat */

module.exports = {
    prelude: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/_prelude.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/_prelude.vertex.glsl', 'utf8')
    },
    circle: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/circle.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/circle.vertex.glsl', 'utf8')
    },
    collisionBox: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/collision_box.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/collision_box.vertex.glsl', 'utf8')
    },
    debug: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/debug.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/debug.vertex.glsl', 'utf8')
    },
    fill: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/fill.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/fill.vertex.glsl', 'utf8')
    },
    fillOutline: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/fill_outline.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/fill_outline.vertex.glsl', 'utf8')
    },
    fillOutlinePattern: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/fill_outline_pattern.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/fill_outline_pattern.vertex.glsl', 'utf8')
    },
    fillPattern: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/fill_pattern.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/fill_pattern.vertex.glsl', 'utf8')
    },
    fillExtrusion: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/fill_extrusion.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/fill_extrusion.vertex.glsl', 'utf8')
    },
    fillExtrusionPattern: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/fill_extrusion_pattern.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/fill_extrusion_pattern.vertex.glsl', 'utf8')
    },
    extrusionTexture: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/extrusion_texture.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/extrusion_texture.vertex.glsl', 'utf8')
    },
    line: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/line.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/line.vertex.glsl', 'utf8')
    },
    linePattern: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/line_pattern.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/line_pattern.vertex.glsl', 'utf8')
    },
    lineSDF: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/line_sdf.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/line_sdf.vertex.glsl', 'utf8')
    },
    raster: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/raster.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/raster.vertex.glsl', 'utf8')
    },
    hillshadePrepare: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/hillshade_prepare.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/hillshade_prepare.vertex.glsl', 'utf8')
    },
    hillshade: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/hillshade.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/hillshade.vertex.glsl', 'utf8')
    },
    symbolIcon: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/symbol_icon.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/symbol_icon.vertex.glsl', 'utf8')
    },
    symbolSDF: {
        fragmentSource: fs.readFileSync(__dirname + '/../shaders/symbol_sdf.fragment.glsl', 'utf8'),
        vertexSource: fs.readFileSync(__dirname + '/../shaders/symbol_sdf.vertex.glsl', 'utf8')
    }
};
