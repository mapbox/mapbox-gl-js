import {test, expect} from "../../../util/vitest.js";
import * as colorSpaces from '../../../../src/style-spec/util/color_spaces.js';
import Color from '../../../../src/style-spec/util/color.js';

test('#hclToRgb zero', () => {
    const hclColor = {h: 0, c: 0, l: 0, alpha: null};
    const rgbColor = new Color(0, 0, 0, null);
    expect(colorSpaces.hcl.reverse(hclColor)).toEqual(rgbColor);
});

test('#hclToRgb', () => {
    const hclColor = {h: 20, c: 20, l: 20, alpha: null};
    const rgbColor = new Color(76.04087881379073, 36.681898967046166, 39.08743507357837, null);
    expect(colorSpaces.hcl.reverse(hclColor)).toEqual(rgbColor);
});

test('#rgbToHcl zero', () => {
    const hclColor = {h: 0, c: 0, l: 0, alpha: null};
    const rgbColor = new Color(0, 0, 0, null);
    expect(colorSpaces.hcl.forward(rgbColor)).toEqual(hclColor);
});

test('#rgbToHcl', () => {
    const hclColor = {h: 158.19859051364818, c: 0.0000029334887311101764, l: 6.318928745123017, alpha: null};
    const rgbColor = new Color(20, 20, 20, null);
    expect(colorSpaces.hcl.forward(rgbColor)).toEqual(hclColor);
});
