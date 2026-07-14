const path = require('node:path');
const harness = require('../browser-check.cjs');

harness.testPages({label: 'webpack', root: __dirname, files: ['esm.html', 'umd.html']});
