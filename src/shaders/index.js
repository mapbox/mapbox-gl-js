
// Shaders entry point for Node (tests and GL Native)
/* eslint-disable import/unambiguous, import/no-commonjs, flowtype/require-valid-file-annotation, no-global-assign */

const fs = require('fs');

// enable ES Modules in Node
require = require("esm")(module);

// enable requiring GLSL in Node
require.extensions['.glsl'] = function (module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    module._compile(`module.exports = \`${content}\``, filename);
};

module.exports = require("./shaders.js");
