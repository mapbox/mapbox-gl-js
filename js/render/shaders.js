'use strict';

var glify = require('glify');

module.exports = {
    "composite": glify('../../shaders/composite.*.glsl'),
    "gaussian": glify('../../shaders/gaussian.*.glsl'),
    "debug": glify('../../shaders/debug.*.glsl'),
    "dot": glify('../../shaders/dot.*.glsl'),
    "fill": glify('../../shaders/fill.*.glsl'),
    "label": glify('../../shaders/label.*.glsl'),
    "line": glify('../../shaders/line.*.glsl'),
    "linepattern": glify('../../shaders/linepattern.*.glsl'),
    "outline": glify('../../shaders/outline.*.glsl'),
    "pattern": glify('../../shaders/pattern.*.glsl'),
    "point": glify('../../shaders/point.*.glsl'),
    "raster": glify('../../shaders/raster.*.glsl'),
    "sdf": glify('../../shaders/sdf.*.glsl')
};
