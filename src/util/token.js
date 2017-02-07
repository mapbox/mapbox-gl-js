'use strict';

// @flow

module.exports = resolveTokens;

/**
 * Replace tokens in a string template with values in an object
 *
 * @param {Object} properties a key/value relationship between tokens and replacements
 * @param {string} text the template string
 * @returns {string} the template with tokens replaced
 * @private
 */
function resolveTokens(properties: {[key: string]: string}, text: string): string {
    return text.replace(/{([^{}]+)}/g, (match, key: string) => {
        return key in properties ? properties[key] : '';
    });
}
