'use strict';

function infix(operator) {
    return function(left, right) { return left + ' ' + operator + ' ' + right; };
}

var infixOperators = {
    '==': infix('==='),
    '>': infix('>'), '$gt': infix('>'),
    '<': infix('<'), '$lt': infix('<'),
    '<=': infix('<='), '$lte': infix('<='),
    '>=': infix('>='), '$gte': infix('>='),
    '!=': infix('!=='), '$ne': infix('!=='),
    '$exists': function (value) { return value + ' !== undefined'; }
};

function or(items)  { return '(' + items.join(' || ') + ')'; }
function and(items) { return '(' + items.join(' && ') + ')'; }
function not(item)  { return '!' + item; }
function nor(items) { return not(or(items)); }

var arrayOperators = {
    '||': or, '$or': or,
    '&&': and, '$and': and,
    '!': nor, '$nor': nor
};

var objOperators = {
    '!': not, '$not': not
};

module.exports = function (filter, excludes) {
    if (!filter) return;

    // simple key & value comparison
    function valueFilter(key, value, operator) {
        return operator('f.properties[' + JSON.stringify(key) + ']', JSON.stringify(value));
    }

    // compares key & value or key & or(values)
    function simpleFieldFilter(key, value, operator) {
        var operatorFn = infixOperators[operator || '=='];
        if (!operatorFn) throw new Error('Unknown operator: ' + operator);

        if (Array.isArray(value)) {
            return or(value.map(function (v) {
                return valueFilter(key, v, operatorFn);
            }));

        } else return valueFilter(key, value, operatorFn);
    }

    // handles any filter key/value pair
    function fieldFilter(key, value) {

        if (Array.isArray(value)) {
            if (key in arrayOperators) { // handle and/or operators
                return arrayOperators[key](value.map(fieldsFilter));
            }

        } else if (typeof value === 'object') {

            // handle not operator
            if (key in objOperators) return objOperators[key](fieldsFilter(value));

            // handle {key: {operator: value}} notation
            var filters = [];
            for (var op in value) {
                filters.push(simpleFieldFilter(key, value[op], op));
            }
            return and(filters);

        }
        // handle simple key/value or key/values comparison
        return simpleFieldFilter(key, value);
    }

    function fieldsFilter(obj) {
        var filters = [];

        for (var key in obj) {
            if (!excludes || excludes.indexOf(key) === -1) {
                filters.push(fieldFilter(key, obj[key]));
            }
        }

        return filters.length ? and(filters) : null;
    }

    var filterStr = fieldsFilter(filter);
    if (!filterStr) return;

    // jshint evil: true
    return new Function('f', 'return ' + filterStr + ';');
};
