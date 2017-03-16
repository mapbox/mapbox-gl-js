'use strict';

const test = require('mapbox-gl-js-test').test;
const colorSpaces = require('../../../../src/style-spec/function/color_spaces');

test('#hclToRgb zero', (t) => {
    const hclColor = [0, 0, 0, null];
    const rgbColor = [0, 0, 0, null];
    t.deepEqual(colorSpaces.hcl.reverse(hclColor), rgbColor);
    t.end();
});

test('#hclToRgb', (t) => {
    const hclColor = [20, 20, 20, null];
    const rgbColor = [76.04087881379073, 36.681898967046166, 39.08743507357837, null];
    t.deepEqual(colorSpaces.hcl.reverse(hclColor), rgbColor);
    t.end();
});

test('#rgbToHcl zero', (t) => {
    const hclColor = [0, 0, 0, null];
    const rgbColor = [0, 0, 0, null];
    t.deepEqual(colorSpaces.hcl.forward(rgbColor), hclColor);
    t.end();
});

test('#rgbToHcl', (t) => {
    const hclColor = [158.19859051364818, 0.0000029334887311101764, 6.318928745123017, null];
    const rgbColor = [20, 20, 20, null];
    t.deepEqual(colorSpaces.hcl.forward(rgbColor), hclColor);
    t.end();
});
