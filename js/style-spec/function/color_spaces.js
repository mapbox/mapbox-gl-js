'use strict';

// Constants
var Xn = 0.950470, // D65 standard referent
    Yn = 1,
    Zn = 1.088830,
    t0 = 4 / 29,
    t1 = 6 / 29,
    t2 = 3 * t1 * t1,
    t3 = t1 * t1 * t1,
    deg2rad = Math.PI / 180,
    rad2deg = 180 / Math.PI;

// Utilities
function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
}

function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
}

function xyz2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function rgb2xyz(x) {
    x /= 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

// LAB
function rgbToLab(rgbColor) {
    var b = rgb2xyz(rgbColor[0]),
        a = rgb2xyz(rgbColor[1]),
        l = rgb2xyz(rgbColor[2]),
        x = xyz2lab((0.4124564 * b + 0.3575761 * a + 0.1804375 * l) / Xn),
        y = xyz2lab((0.2126729 * b + 0.7151522 * a + 0.0721750 * l) / Yn),
        z = xyz2lab((0.0193339 * b + 0.1191920 * a + 0.9503041 * l) / Zn);

    return [
        116 * y - 16,
        500 * (x - y),
        200 * (y - z),
        rgbColor[3]
    ];
}

function labToRgb(labColor) {
    var y = (labColor[0] + 16) / 116,
        x = isNaN(labColor[1]) ? y : y + labColor[1] / 500,
        z = isNaN(labColor[2]) ? y : y - labColor[2] / 200;
    y = Yn * lab2xyz(y);
    x = Xn * lab2xyz(x);
    z = Zn * lab2xyz(z);
    return [
        xyz2rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z), // D65 -> sRGB
        xyz2rgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z),
        xyz2rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
        labColor[3]
    ];
}

// HCL
function rgbToHcl(rgbColor) {
  var labColor = rgbToLab(rgbColor);
  var l = labColor[0],
    a = labColor[1],
    b = labColor[2];
  var h = Math.atan2(b, a) * rad2deg;
  return [
      h < 0 ? h + 360 : h,
      Math.sqrt(a * a + b * b),
      l,
      rgbColor[3]
  ];
}

function hclToRgb(hclColor) {
  var h = hclColor[0] * deg2rad,
    c = hclColor[1],
    l = hclColor[2];
  return labToRgb([
      l,
      Math.cos(h) * c,
      Math.sin(h) * c,
      hclColor[3]
  ]);
}

module.exports = {
  lab: {
    forward: rgbToLab,
    reverse: labToRgb
  },
  hcl: {
    forward: rgbToHcl,
    reverse: hclToRgb
  }
};
