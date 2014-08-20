'use strict';

var glify = require('glify');

module.exports = {
    "composite": glify('../../shaders/composite.*.glsl'),
    "debug": glify('../../shaders/debug.*.glsl'),
    "dot": glify('../../shaders/dot.*.glsl'),
    "fill": glify('../../shaders/fill.*.glsl'),
    "gaussian": glify('../../shaders/gaussian.*.glsl'),
    "line": glify('../../shaders/line.*.glsl'),
    "lineimage": glify('../../shaders/lineimage.*.glsl'),
    "linesdf": glify('../../shaders/linesdf.*.glsl'),
    "outline": glify('../../shaders/outline.*.glsl'),
    "pattern": glify('../../shaders/pattern.*.glsl'),
    "raster": glify('../../shaders/raster.*.glsl'),
    "icon": glify('../../shaders/icon.*.glsl'),
    "sdf": glify('../../shaders/sdf.*.glsl')
};
