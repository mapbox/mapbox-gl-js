'use strict';

var VectorTileFeatureTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

function infix(operator) {
    return function(_, key, value) {
        if (key === '$type') {
            return 't' + operator + VectorTileFeatureTypes.indexOf(value);
        } else {
            return 'p[' + JSON.stringify(key) + ']' + operator + JSON.stringify(value);
        }
    };
}

function strictInfix(operator) {
    var nonstrictInfix = infix(operator);
    return function(_, key, value) {
        if (key === '$type') {
            return nonstrictInfix(_, key, value);
        } else {
            return 'typeof(p[' + JSON.stringify(key) + ']) === typeof(' + JSON.stringify(value) + ') && ' +
                nonstrictInfix(_, key, value);
        }
    };
}

var operators = {
    '==': infix('==='),
    '!=': infix('!=='),
    '>': strictInfix('>'),
    '<': strictInfix('<'),
    '<=': strictInfix('<='),
    '>=': strictInfix('>='),
    'in': function(_, key) {
        return Array.prototype.slice.call(arguments, 2).map(function(value) {
            return '(' + operators['=='](_, key, value) + ')';
        }).join('||') || 'false';
    },
    '!in': function() {
        return '!(' + operators.in.apply(this, arguments) + ')';
    },
    'any': function() {
        return Array.prototype.slice.call(arguments, 1).map(function(filter) {
            return '(' + compile(filter) + ')';
        }).join('||') || 'false';
    },
    'all': function() {
        return Array.prototype.slice.call(arguments, 1).map(function(filter) {
            return '(' + compile(filter) + ')';
        }).join('&&') || 'true';
    },
    'none': function() {
        return '!(' + operators.any.apply(this, arguments) + ')';
    }
};

function compile(filter) {
    return operators[filter[0]].apply(filter, filter);
}

function truth() {
    return true;
}

module.exports = function (filter) {
    if (!filter) return truth;
    var filterStr = 'var p = f.properties || f.tags || {}, t = f.type; return ' + compile(filter) + ';';
    // jshint evil: true
    return new Function('f', filterStr);
};
