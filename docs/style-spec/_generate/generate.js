#!/usr/bin/env node

// GL style reference generator

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ref = require('../../../src/style-spec/reference/latest');
const _ = require('lodash');
const remark = require('remark');
const html = require('remark-html');

const {expressions, expressionGroups} = require('./expression-metadata');

const groupedExpressions = [
    'Types',
    'Feature data',
    'Lookup',
    'Decision',
    'Ramps, scales, curves',
    'Variable binding',
    'String',
    'Color',
    'Math',
    'Zoom',
    'Heatmap'
].map(group => ({
    name: group,
    expressions: expressionGroups[group]
        .sort((a, b) => a.localeCompare(b))
        .map(name => expressions[name])
}));

assert(groupedExpressions.length === Object.keys(expressionGroups).length, 'All expression groups accounted for in generated docs');

function tmpl(x, options) {
    return _.template(fs.readFileSync(path.join(__dirname, x), 'utf-8'), options);
}

const index = tmpl('index.html', {
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
        groupedExpressions: groupedExpressions,
        renderExpression: tmpl('expression.html', {
            imports: {
                _: _,
                renderSignature: renderSignature,
                md: function(markdown) {
                    return remark().use(html).process(markdown);
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
            result.push(`${repeated.slice(2)}, (${repeated.slice(2)}${repeated}, ...)`);
        }
    }

    // length of result = each (', ' + item)
    const length = result.reduce((l, s) => l + s.length + 2, 0);
    return (!maxLength || length <= maxLength) ?
        result.join(', ') :
        `${result.join(',\n    ')}\n`;
}

fs.writeFileSync(path.join(__dirname, '../index.html'), index({ ref: ref }));
