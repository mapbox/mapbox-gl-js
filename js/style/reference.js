'use strict';

var fs = require('fs');
var ref = fs.readFileSync(__dirname + '/../../node_modules/gl-style/reference/latest-style-raw.json', 'utf8');
module.exports = JSON.parse(ref);
