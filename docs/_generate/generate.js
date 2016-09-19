#!/usr/bin/env node

// GL style reference generator

var fs = require('fs');
var path = require('path');
var ref = require('../..').latest;
var _ = require('lodash');
var remark = require('remark');
var html = require('remark-html');

function tmpl(x, options) {
  return _.template(fs.readFileSync(path.join(__dirname, x), 'utf-8'), options);
}

var index = tmpl('index.html', {
  imports: {
    _: _,
    item: tmpl('item.html', {
      imports: {
        _: _,
        md: function(markdown) {
          return remark().use(html).process(markdown);
        }
      }
    })
  }
});

fs.writeFileSync(path.join(__dirname, '../index.html'), index({ ref: ref }));
