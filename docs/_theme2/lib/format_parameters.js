'use strict';
var formatMarkdown = require('./format_markdown');

/**
 * Format a parameter name. This is used in formatParameters
 * and just needs to be careful about differentiating optional
 * parameters
 *
 * @param {Object} param a param as a type spec
 * @returns {string} formatted parameter representation.
 */
function formatParameter(param) {
  return param.name + ': ' + formatMarkdown.type(param.type).replace(/\n/g, '');
}

/**
 * Format the parameters of a function into a quickly-readable
 * summary that resembles how you would call the function
 * initially.
 *
 * @param {Object} section  comment node from documentation
 * @returns {string} formatted parameters
 */
module.exports = function formatParams(section) {
  if (section.params) {
    return '(' + section.params.map(function (param) {
      return formatParameter(param);
    }).join(', ') + ')';
  } else if (!section.params && (section.type === 'function' || section.type === 'class')) {
    return '()';
  }
  return '';
};
