'use strict';

module.exports = resolveTokens;

/**
 * Replace tokens in a string template with values in an object
 *
 * @param {Object} properties a key/value relationship between tokens and replacements
 * @param {string} text the template string
 * @returns {string} the template with tokens replaced
 * @private
 */
function resolveTokens(properties, text, numericMultiplier) {
    return text.replace(/{([^{}]+)}/g, function(match, key) {
        var value = key in properties ? properties[key] : '';
        if (typeof value === 'number' && numericMultiplier !== undefined) {
            value = Math.round(value * numericMultiplier) / numericMultiplier;
        }
        return value;
    });
}
