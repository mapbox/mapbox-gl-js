// @flow
/* eslint-disable import/no-commonjs */

require('@mapbox/flow-remove-types/register');

const fs = require('fs');

function loadFile(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    module._compile(`module.exports = ${JSON.stringify(content)};`, filename);
}

// $FlowFixMe: Flow doesn't know about require.extensions
require.extensions['.glsl'] = loadFile;
