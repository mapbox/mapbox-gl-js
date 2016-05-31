'use strict';

var remark = require('remark'),
  html = require('remark-html'),
  visit = require('unist-util-visit'),
  utils = require('documentation-theme-utils');

function getHref(paths) {
  return function (text) {
    if (paths && paths.indexOf(text) >= 0) {
      return '#' + text;
    }
  };
}

function rerouteLinks(ast) {
  visit(ast, 'link', function (node) {
    if (node.jsdoc) {
      node.url = '#' + node.url;
    }
  });
  return ast;
}

/**
 * This helper is exposed in templates as `md` and is useful for showing
 * Markdown-formatted text as proper HTML.
 *
 * @name formatMarkdown
 * @param {Object} ast - mdast tree
 * @returns {string} HTML
 * @example
 * var x = remark.parse('## foo');
 * // in template
 * // {{ md x }}
 * // generates <h2>foo</h2>
 */
module.exports = function (ast) {
  if (ast) {
    return remark().use(html).stringify(rerouteLinks(ast));
  }
};

module.exports.type = function (type, paths) {
  return module.exports({
    type: 'root',
    children: utils.formatType(type, getHref(paths))
  }).replace(/\n/g, '');
};

/**
 * Link text to this page or to a central resource.
 * @param {Array<string>} paths list of valid namespace paths that are linkable
 * @param {string} text inner text of the link
 * @param {string} description link text override
 * @returns {string} potentially linked HTML
 */
module.exports.link = function (paths, text, description) {
  return module.exports({
    type: 'root',
    children: [utils.link(text, getHref(paths), description)]
  }).replace(/\n/g, '');
};
