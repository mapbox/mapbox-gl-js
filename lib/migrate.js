'use strict';

/**
 * Migrate a Mapbox GL Style to the latest version.
 *
 * @alias migrate
 * @param {object} style a Mapbox GL Style
 * @returns {Object} a migrated style
 * @example
 * var fs = require('fs');
 * var migrate = require('mapbox-gl-style-spec').migrate;
 * var style = fs.readFileSync('./style.json', 'utf8');
 * fs.writeFileSync('./style.json', JSON.stringify(migrate(style)));
 */
module.exports = function(style) {
    var migrated = false;

    if (style.version === 2) {
        style = require('../migrations/v3')(style);
        migrated = true;
    }

    if (style.version === 3) {
        style = require('../migrations/v4')(style);
        style = require('../migrations/v4-bonus')(style);
        migrated = true;
    }

    if (style.version === 4) {
        style = require('../migrations/v5')(style);
        migrated = true;
    }

    if (style.version === 5) {
        style = require('../migrations/v6')(style);
        migrated = true;
    }

    if (style.version === 6 || style.version === 7) {
        style = require('../migrations/v7')(style);
        migrated = true;
    }

    if (!migrated) {
        throw new Error('cannot migrate from', style.version);
    }

    return style;
};
