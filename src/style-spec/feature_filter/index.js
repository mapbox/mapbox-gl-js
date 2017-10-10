// @flow

const {createExpression} = require('../expression');

import type {GlobalProperties} from '../expression';
export type FeatureFilter = (globalProperties: GlobalProperties, feature: VectorTileFeature) => boolean;

module.exports = createFilter;
module.exports.isExpressionFilter = isExpressionFilter;

function isExpressionFilter(filter) {
    if (!Array.isArray(filter) || filter.length === 0) {
        return false;
    }
    switch (filter[0]) {
    case 'has':
        return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';

    case 'in':
    case '!in':
    case '!has':
    case 'none':
        return false;

    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
        return filter.length === 3 && (Array.isArray(filter[1]) || Array.isArray(filter[2]));

    case 'any':
    case 'all':
        for (const f of filter.slice(1)) {
            if (!isExpressionFilter(f)) {
                return false;
            }
        }
        return true;

    default:
        return true;
    }
}

const filterSpec = {
    'type': 'boolean',
    'default': false,
    'function': true,
    'property-function': true
};

/**
 * Given a filter expressed as nested arrays, return a new function
 * that evaluates whether a given feature (with a .properties or .tags property)
 * passes its test.
 *
 * @private
 * @param {Array} filter mapbox gl filter
 * @returns {Function} filter-evaluating function
 */
function createFilter(filter: any): FeatureFilter {
    if (!filter) {
        return () => true;
    }

    const isExpression = isExpressionFilter(filter);
    const expression = isExpression ? filter : convertFilter(filter);
    const compiled = createExpression(expression, filterSpec, 'filter', {handleErrors: isExpression});

    if (compiled.result === 'success') {
        return compiled.evaluate;
    } else {
        throw new Error(compiled.errors.map(err => `${err.key}: ${err.message}`).join(', '));
    }
}

function convertFilter(filter: ?Array<any>): mixed {
    if (!filter) return true;
    const op = filter[0];
    if (filter.length <= 1) return (op !== 'any');
    const converted =
        op === '==' ? compileComparisonOp(filter[1], filter[2], '==') :
        op === '!=' ? compileNegation(compileComparisonOp(filter[1], filter[2], '==')) :
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ? compileComparisonOp(filter[1], filter[2], op) :
        op === 'any' ? compileDisjunctionOp(filter.slice(1)) :
        op === 'all' ? ['all'].concat(filter.slice(1).map(convertFilter)) :
        op === 'none' ? ['all'].concat(filter.slice(1).map(convertFilter).map(compileNegation)) :
        op === 'in' ? compileInOp(filter[1], filter.slice(2)) :
        op === '!in' ? compileNegation(compileInOp(filter[1], filter.slice(2))) :
        op === 'has' ? compileHasOp(filter[1]) :
        op === '!has' ? compileNegation(compileHasOp(filter[1])) :
        true;
    return converted;
}

function compileComparisonOp(property: string, value: any, op: string) {
    switch (property) {
    case '$type':
        return [`filter-type-${op}`, value];
    case '$id':
        return [`filter-id-${op}`, value];
    default:
        return [`filter-${op}`, property, value];
    }
}

function compileDisjunctionOp(filters: Array<Array<any>>) {
    return ['any'].concat(filters.map(convertFilter));
}

function compileInOp(property: string, values: Array<any>) {
    if (values.length === 0) { return false; }
    switch (property) {
    case '$type':
        return [`filter-type-in`, ['literal', values]];
    case '$id':
        return [`filter-id-in`, ['literal', values]];
    default:
        if (values.length > 200 && !values.some(v => typeof v !== typeof values[0])) {
            return ['filter-in-large', property, ['literal', values.sort((a, b) => a < b ? -1 : a > b ? 1 : 0)]];
        } else {
            return ['filter-in-small', property, ['literal', values]];
        }
    }
}

function compileHasOp(property: string) {
    switch (property) {
    case '$type':
        return true;
    case '$id':
        return [`filter-has-id`];
    default:
        return [`filter-has`, property];
    }
}

function compileNegation(filter: mixed) {
    return ['!', filter];
}

