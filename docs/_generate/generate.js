#!/usr/bin/env node

// GL style reference generator

var fs = require('fs'),
    path = require('path'),
    ref = require('../..').latest,
    _ = require('underscore');

function tmpl(x) {
  return _.template(fs.readFileSync(path.join(__dirname, x), 'utf-8'));
}

var index = tmpl('index.html');
var item = tmpl('item.html');

fs.writeFileSync(path.join(__dirname, '../index.html'), index({
  ref: ref,
  item: item,
  _: _
}));
