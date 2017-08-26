// @flow

const {createExpression} = require('../expression');
const {typeOf} = require('../expression/values');

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
        op === '!=' ? compileComparisonOp(filter[1], filter[2], '!=') :
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

function compilePropertyReference(property: string, type?: ?string) {
    if (property === '$type') return ['geometry-type'];
    const ref = property === '$id' ? ['id'] : ['get', property];
    return type ? [type, ref] : ref;
}

function compileComparisonOp(property: string, value: any, op: string) {
    const untypedReference = compilePropertyReference(property);
    const typedReference = compilePropertyReference(property, typeof value);

    if (value === null) {
        const expression = [
            'all',
            compileHasOp(property),
            ['==', ['typeof', untypedReference], 'Null']
        ];
        return op === '!=' ? ['!', expression] : expression;
    }

    const type = typeOf(value).kind;
    if (op === '!=') {
        return [
            'any',
            ['!=', ['typeof', untypedReference], type],
            ['!=', typedReference, value]
        ];
    }

    return [
        'all',
        ['==', ['typeof', untypedReference], type],
        [op, typedReference, value]
    ];
}

function compileDisjunctionOp(filters: Array<Array<any>>) {
    return ['any'].concat(filters.map(convertFilter));
}

function compileInOp(property: string, values: Array<any>) {
    if (values.length === 0) {
        return false;
    }

    // split the input values into separate lists by type, so that
    // we can first test the input's type and dispatch to a typed 'match'
    // expression
    const valuesByType = {};
    for (const value of values) {
        const type = typeOf(value).kind;
        valuesByType[type] = valuesByType[type] || [];
        valuesByType[type].push(value);
    }

    const input = compilePropertyReference(property);
    const expression = [
        'let',
        'input', input
    ];

    const match = ['match', ['typeof', ['var', 'input']]];
    for (const type in valuesByType) {
        match.push(type);
        if (type === 'Null') {
            match.push(true);
        } else {
            match.push([
                'match',
                ['var', 'input'],
                valuesByType[type],
                true,
                false
            ]);
        }
    }

    if (match.length === 4) {
        const type = match[2];
        expression.push([
            'all',
            ['==', ['typeof', ['var', 'input']], type],
            match[3]
        ]);
    } else {
        expression.push(match);
    }

    return expression;
}

function compileHasOp(property: string) {
    if (property === '$id') {
        return ['!=', ['typeof', ['id']], 'Null'];
    }

    if (property === '$type') {
        return true;
    }

    return ['has', property];
}

function compileNegation(filter: mixed) {
    return ['!', filter];
}

