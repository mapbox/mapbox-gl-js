#!/usr/bin/env node

// GL style reference generator

var fs = require('fs');
var path = require('path');
var ref = require('../../../src/style-spec/reference/latest');
var _ = require('lodash');
var remark = require('remark');
var html = require('remark-html');

var expressionTypes = require('./expression-types');


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
    }),
    expressions: Object.keys(expressionTypes).sort((a, b) => a.localeCompare(b)),
    renderExpression: tmpl('expression.html', {
      imports: {
        _: _,
        expressionDocs: ref['expression_name'].values,
        expressionTypes: expressionTypes,
        renderSignature: renderSignature,
        md: function(markdown) {
          return remark().use(html).process(markdown)
        }
      }
    })
  }
});

function renderSignature (name, overload) {
    name = JSON.stringify(name);
    const maxLength = 80 - name.length - overload.type.length;
    const params = renderParams(overload.parameters, maxLength);
    return `[${name}${params}]: ${overload.type}`;
}

function renderParams (params, maxLength) {
    const result = [''];
    for (const t of params) {
        if (typeof t === 'string') {
            result.push(t);
        } else if (t.name) {
            result.push(`${t.name}: ${t.type}`);
        } else if (t.repeat) {
            const repeated = renderParams(t.repeat, Infinity);
            result.push(`${repeated.slice(2)}${repeated}, ...`);
        }
    }

    // length of result = each (', ' + item)
    const length = result.reduce((l, s) => l + s.length + 2, 0);
    return (!maxLength || length <= maxLength) ?
        result.join(', ') :
        `${result.join(',\n    ')}\n`;
}

fs.writeFileSync(path.join(__dirname, '../index.html'), index({ ref: ref }));
