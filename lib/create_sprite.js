'use strict';

var spritesmith = require('spritesmith'),
    path = require('path');

/**
 * Generate a sprite from an array of named images
 * @param {Array<String>} src an array of file paths
 * @param {Number} [pixelRatio=1] whether the sprite is 2x.
 * @param {Function} callback called with (err, metadata, image)
 * @returns {undefined} nothing
 */
function createSprite(src, pixelRatio, callback) {
    var options = { padding: 2, format: 'png', src: src };

    spritesmith(options, function(err, result) {
        if (err) return callback(err);
        var coordinates = {};
        for (var filename in result.coordinates) {
            var spriteID = path.basename(filename)
                .replace('.png', '').replace('@2x', '');
            coordinates[spriteID] = result.coordinates[filename];
            coordinates[spriteID].pixelRatio = pixelRatio;
        }
        callback(err, coordinates, result.image);
    });
}

module.exports = createSprite;
