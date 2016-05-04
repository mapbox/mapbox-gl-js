'use strict';

var hljs = require('highlight.js');

module.exports = function (hljsOptions) {
  hljs.configure(hljsOptions);

  return function (example) {
    if (hljsOptions.highlightAuto) {
      return hljs.highlightAuto(example).value;
    }
    return hljs.highlight('js', example).value;
  };
};
