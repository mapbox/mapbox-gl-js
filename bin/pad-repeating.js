#!/usr/bin/env node
'use strict';

var fs = require('fs');
var Canvas = require('canvas');

module.exports = padImage;

if (require.main === module) {
    if (process.argv.length != 4) {
        console.log("Usage: ./pad-repeating inputfile outputfile");
        process.exit();
    }
    var input = process.argv[2];
    var output = process.argv[3];
    fs.writeFileSync(output, padImage(fs.readFileSync(input)));
}


/*
 * Adds a 1px padding around the image. The padding is taken from the image's opposite edge.
 * Used for images that will be added to a sprite and used in a repeating pattern.
 *
 * This way, when gl scales and samples an edge pixel it can properly calculate edge values and avoid seams.
*/
function padImage(buf) {


    var img = new Canvas.Image();
    img.src = buf;

    var canvas = new Canvas(img.width + 2, img.height+2);
    var ctx = canvas.getContext('2d');

    // main image
    ctx.drawImage(img, 1, 1, img.width, img.height);
    // left
    ctx.drawImage(img, img.width - 1, 0, 1, img.height, 0, 1, 1, img.height);
    // top
    ctx.drawImage(img, 0, img.height - 1, img.width, 1, 1, 0, img.width, 1);
    // right
    ctx.drawImage(img, 0, 0, 1, img.height, 1 + img.width, 1, 1, img.height);
    // bottom
    ctx.drawImage(img, 0, 0, img.width, 1, 1, 1 + img.height, img.width, 1);
    // top left
    ctx.drawImage(img, img.width - 1, img.height - 1, 1, 1, 0, 0, 1, 1);
    // top right
    ctx.drawImage(img, 0, img.height - 1, 1, 1, 1 + img.width, 0, 1, 1);
    // bottom left
    ctx.drawImage(img, img.width - 1, 0, 1, 1, 0, 1 + img.height, 1, 1);
    // bottom right
    ctx.drawImage(img, 0, 0, 1, 1, 1 + img.width, 1 + img.height, 1, 1);

    return canvas.toBuffer();
}
