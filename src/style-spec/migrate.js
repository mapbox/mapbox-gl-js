
/**
 * Migrate a Mapbox GL Style to the latest version.
 *
 * @private
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
    let migrated = false;

    if (style.version === 7 || style.version === 8) {
        style = require('./migrate/v8')(style);
        migrated = true;
    }

    if (!migrated) {
        throw new Error('cannot migrate from', style.version);
    }

    return style;
};
