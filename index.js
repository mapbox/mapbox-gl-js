'use strict';

module.exports = createFilter;

var types = ['Unknown', 'Point', 'LineString', 'Polygon'];

/**
 * Given a filter expressed as nested arrays, return a new function
 * that evaluates whether a given feature (with a .properties or .tags property)
 * passes its test.
 *
 * @param {Array} filter mapbox gl filter
 * @returns {Function} filter-evaluating function
 */
function createFilter(filter) {
    return new Function('f', 'var p = (f && f.properties || {}); return ' + compile(filter));
}

function compile(filter) {
    if (!filter) return 'true';
    var op = filter[0];
    if (filter.length <= 1) return op === 'any' ? 'false' : 'true';
    var str =
        op === '==' ? compare(filter[1], filter[2], '===', false) :
        op === '!=' ? compare(filter[1], filter[2], '!==', false) :
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ? compare(filter[1], filter[2], op, true) :
        op === 'any' ? filter.slice(1).map(compile).join('||') :
        op === 'all' ? filter.slice(1).map(compile).join('&&') :
        op === 'none' ? '!(' + filter.slice(1).map(compile).join('||') + ')' :
        op === 'in' ? compileIn(filter[1], filter.slice(2)) :
        op === '!in' ? '!(' + compileIn(filter[1], filter.slice(2)) + ')' :
        op === 'has' ? compileHas(filter[1]) :
        op === '!has' ? negate(compileHas([filter[1]])) :
        'true';
    return '(' + str + ')';
}

function valueExpr(key) {
    return key === '$type' ? 'f.type' : 'p[' + JSON.stringify(key) + ']';
}
function compare(key, val, op, checkType) {
    var left = valueExpr(key);
    var right = key === '$type' ? types.indexOf(val) : JSON.stringify(val);
    return (checkType ? 'typeof ' + left + '=== typeof ' + right + '&&' : '') + left + op + right;
}
function compileIn(key, values) {
    if (key === '$type') values = values.map(function(value) { return types.indexOf(value); });
    var left = JSON.stringify(values.sort(compareFn));
    var right = valueExpr(key);

    if (values.length <= 200) return left + '.indexOf(' + right + ') !== -1';

    return 'function(v, a, i, j) {' +
        'while (i <= j) { var m = (i + j) >> 1;' +
        '    if (a[m] === v) return true; if (a[m] > v) j = m - 1; else i = m + 1;' +
        '}' +
    'return false; }(' + right + ', ' + left + ',0,' + (values.length - 1) + ')';
}

function compileHas(key) {
    return JSON.stringify(key) + ' in p';
}

function compareFn(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function negate(expression) {
    return '!(' + expression + ')';
}
