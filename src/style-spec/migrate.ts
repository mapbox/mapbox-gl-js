import migrateToV8 from './migrate/v8';
import migrateToExpressions from './migrate/expressions';

import type {StyleSpecification} from './types';

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
export default function (style: {version: 7} | StyleSpecification): StyleSpecification {
    let migrated = false;

    if (style.version === 7) {
        style = migrateToV8(style);
        migrated = true;
    }

    if (style.version === 8) {
        style = migrateToExpressions(style);
        migrated = true;
    }

    if (!migrated) {
        throw new Error(`Cannot migrate from ${style.version}`);
    }

    return style as StyleSpecification;
}
