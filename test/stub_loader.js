// Load our stubbed ajax module for the integration suite implementation
const fs = require('fs');
const assert = require('assert');
const pirates = require('pirates');

pirates.addHook((code, filename) => {
    assert(filename.endsWith('/ajax.js'));
    return fs.readFileSync(`${__dirname}/ajax_stubs.js`, 'utf-8');
}, {
    exts: ['.js'],
    matcher: filename => filename.endsWith('/ajax.js')
});

