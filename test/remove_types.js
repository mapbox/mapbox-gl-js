'use strict';

const fs = require('fs');
const removeTypes = require('flow-remove-types');

require.extensions['.js'] = function(module, filename) {
    let source = fs.readFileSync(filename, 'utf8');
    if (filename.indexOf('node_modules') === -1) {
        source = removeTypes(source);
    }
    module._compile(source, filename);
};
