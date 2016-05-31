'use strict';

var formatMarkdown = require('./format_markdown');
var Syntax = require('doctrine').Syntax;

/**
 * Format a parameter name. This is used in formatParameters
 * and just needs to be careful about differentiating optional
 * parameters
 *
 * @param {Object} param a param as a type spec
 * @returns {string} formatted parameter representation.
 */
function formatParameter(param, short) {
  if (short) {
    return param.type.type == Syntax.OptionalType ? '[' + param.name + ']' : param.name;
  } else {
    return param.name + ': ' + formatMarkdown.type(param.type).replace(/\n/g, '');
  }
}

/**
 * Format the parameters of a function into a quickly-readable
 * summary that resembles how you would call the function
 * initially.
 *
 * @param {Object} section  comment node from documentation
 * @returns {string} formatted parameters
 */
module.exports = function formatParams(section, short) {
  if (section.params) {
    return '(' + section.params.map(function (param) {
      return formatParameter(param, short);
    }).join(', ') + ')';
  } else if (!section.params && (section.kind === 'function' || section.kind === 'class')) {
    return '()';
  }
  return '';
};
