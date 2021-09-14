// @flow

import {createExpression} from '../expression/index.js';
import type {GlobalProperties, Feature} from '../expression/index.js';
import type {CanonicalTileID} from '../../source/tile_id.js';
import type MercatorCoordinate from '../../geo/mercator_coordinate.js';

type FilterExpression = (globalProperties: GlobalProperties, feature: Feature, canonical?: CanonicalTileID) => boolean;
export type FeatureFilter = {filter: FilterExpression, dynamicFilter: FilterExpression, needGeometry: boolean};

export default createFilter;
export {isExpressionFilter, isDynamicFilter, extractStaticFilter};

function isExpressionFilter(filter: any) {
    if (filter === true || filter === false) {
        return true;
    }

    if (!Array.isArray(filter) || filter.length === 0) {
        return false;
    }
    switch (filter[0]) {
    case 'has':
        return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';

    case 'in':
        return filter.length >= 3 && (typeof filter[1] !== 'string' || Array.isArray(filter[2]));

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
        return filter.length !== 3 || (Array.isArray(filter[1]) || Array.isArray(filter[2]));

    case 'any':
    case 'all':
        for (const f of filter.slice(1)) {
            if (!isExpressionFilter(f) && typeof f !== 'boolean') {
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
    'transition': false,
    'property-type': 'data-driven',
    'expression': {
        'interpolated': false,
        'parameters': ['zoom', 'feature', 'pitch', 'distance-from-center']
    }
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
    if (filter === null || filter === undefined) {
        return {filter: () => true, dynamicFilter: () => true, needGeometry: false};
    }

    if (!isExpressionFilter(filter)) {
        filter = convertFilter(filter);
    }

    let staticFilter = true;
    try {
        staticFilter = extractStaticFilter(filter);
    } catch (e) {
        console.warn(
`Failed to extract static filter. Filter will continue working, but at higher memory usage and slower framerate.
This is most likely a bug, please report this via https://github.com/mapbox/mapbox-gl-js/issues/new?assignees=&labels=&template=Bug_report.md
and paste the contents of this message in the report.
Thank you!
Filter Expression:
${JSON.stringify(filter, null, 2)}
        `);
    }
    const dynamicFilter = filter === staticFilter ? true : filter;

    const compiledStaticFilter = createExpression(staticFilter, filterSpec);
    const compiledDynamicFilter = createExpression(dynamicFilter, filterSpec);
    if (compiledStaticFilter.result === 'error' || compiledDynamicFilter.result === 'error') {
        const staticFilterErrors = compiledStaticFilter.result === 'error' ?
            compiledStaticFilter.value.map(err => `${err.key}: ${err.message}`).join(', ') :
            'None';

        const dynamicFilterErrors = compiledDynamicFilter.result === 'error' ?
            compiledDynamicFilter.value.map(err => `${err.key}: ${err.message}`).join(', ') :
            'None';

        const errorMsg = `static-filter errors:
            ${staticFilterErrors}

            dynamic-filter errors:
            ${dynamicFilterErrors}
        `;
        throw new Error(errorMsg);
    } else {
        const needGeometry = geometryNeeded(staticFilter);
        return {
            filter: (globalProperties: GlobalProperties, feature: Feature, canonical?: CanonicalTileID) => compiledStaticFilter.value.evaluate(globalProperties, feature, {}, canonical),
            dynamicFilter: (globalProperties: GlobalProperties, feature: Feature, canonical?: CanonicalTileID, refLocation: ?MercatorCoordinate) => compiledDynamicFilter.value.evaluate(globalProperties, feature, {}, canonical, null, null, refLocation),
            needGeometry
        };
    }
}

function extractStaticFilter(filter: any): any {
    if (!isDynamicFilter(filter)) {
        return filter;
    }

    // Shallow copy so we can replace expressions in-place
    let result = filter.slice();

    // 1. Union branches
    unionDynamicBranches(result);

    // 2. Collapse dynamic conditions to  `true`
    result = collapseDynamicBooleanExpressions(result);

    return result;
}

function collapseDynamicBooleanExpressions(expression: any): any {
    if (!Array.isArray(expression)) {
        return expression;
    }

    const collapsed = collapsedExpression(expression);
    if (collapsed === true) {
        return collapsed;
    } else {
        return collapsed.map((subExpression) => collapseDynamicBooleanExpressions(subExpression));
    }
}

const dynamicConditionExpressions = new Set([
    'in',
    '==',
    '!=',
    '>',
    '>=',
    '<',
    '<=',
    'to-boolean'
]);

function collapsedExpression(expression: any): any {
    if (dynamicConditionExpressions.has(expression[0])) {

        for (let i = 1; i < expression.length; i++) {
            const param = expression[i];
            if (isDynamicFilter(param)) {
                return true;
            }
        }
    }
    return expression;
}

/**
 * Traverses the expression and replaces all instances of branching on a
 * `dynamic` conditional (such as `['pitch']` or `['distance-from-center']`)
 * into an `any` expression.
 * This ensures that all possible outcomes of a `dynamic` branch are considered
 * when evaluating the expression upfront during filtering.
 *
 * @param {Array<any>} filter the filter expression mutated in-place.
 */
function unionDynamicBranches(filter: any) {
    let isBranchingDynamically = false;
    const branches = [];

    if (filter[0] === 'case') {
        for (let i = 1; i < filter.length - 1; i += 2) {
            isBranchingDynamically = isBranchingDynamically || isDynamicFilter(filter[i]);
            branches.push(filter[i + 1]);
        }

        branches.push(filter[filter.length - 1]);
    } else if (filter[0] === 'match') {
        isBranchingDynamically = isBranchingDynamically || isDynamicFilter(filter[1]);

        for (let i = 2; i < filter.length - 1; i += 2) {
            branches.push(filter[i + 1]);
        }
        branches.push(filter[filter.length - 1]);
    } else if (filter[0] === 'step') {
        isBranchingDynamically = isBranchingDynamically || isDynamicFilter(filter[1]);

        for (let i = 1; i < filter.length - 1; i += 2) {
            branches.push(filter[i + 1]);
        }
    }

    if (isBranchingDynamically) {
        filter.length = 0;
        filter.push('any', ...branches);
    }

    // traverse and recurse into children
    for (let i = 1; i < filter.length; i++) {
        unionDynamicBranches(filter[i]);
    }
}

function isDynamicFilter(filter: any): boolean {
    // Base Cases
    if (!Array.isArray(filter)) {
        return false;
    }
    if (isRootExpressionDynamic(filter[0])) {
        return true;
    }

    for (let i = 1; i < filter.length; i++) {
        const child = filter[i];
        if (isDynamicFilter(child)) {
            return true;
        }
    }

    return false;
}

function isRootExpressionDynamic(expression: string): boolean {
    return expression === 'pitch' ||
        expression === 'distance-from-center';
}

// Comparison function to sort numbers and strings
function compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function geometryNeeded(filter) {
    if (!Array.isArray(filter)) return false;
    if (filter[0] === 'within') return true;
    for (let index = 1; index < filter.length; index++) {
        if (geometryNeeded(filter[index])) return true;
    }
    return false;
}

function convertFilter(filter: ?Array<any>): mixed {
    if (!filter) return true;
    const op = filter[0];
    if (filter.length <= 1) return (op !== 'any');
    const converted =
        op === '==' ? convertComparisonOp(filter[1], filter[2], '==') :
        op === '!=' ? convertNegation(convertComparisonOp(filter[1], filter[2], '==')) :
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ? convertComparisonOp(filter[1], filter[2], op) :
        op === 'any' ? convertDisjunctionOp(filter.slice(1)) :
        op === 'all' ? ['all'].concat(filter.slice(1).map(convertFilter)) :
        op === 'none' ? ['all'].concat(filter.slice(1).map(convertFilter).map(convertNegation)) :
        op === 'in' ? convertInOp(filter[1], filter.slice(2)) :
        op === '!in' ? convertNegation(convertInOp(filter[1], filter.slice(2))) :
        op === 'has' ? convertHasOp(filter[1]) :
        op === '!has' ? convertNegation(convertHasOp(filter[1])) :
        op === 'within' ? filter :
        true;
    return converted;
}

function convertComparisonOp(property: string, value: any, op: string) {
    switch (property) {
    case '$type':
        return [`filter-type-${op}`, value];
    case '$id':
        return [`filter-id-${op}`, value];
    default:
        return [`filter-${op}`, property, value];
    }
}

function convertDisjunctionOp(filters: Array<Array<any>>) {
    return ['any'].concat(filters.map(convertFilter));
}

function convertInOp(property: string, values: Array<any>) {
    if (values.length === 0) { return false; }
    switch (property) {
    case '$type':
        return [`filter-type-in`, ['literal', values]];
    case '$id':
        return [`filter-id-in`, ['literal', values]];
    default:
        if (values.length > 200 && !values.some(v => typeof v !== typeof values[0])) {
            return ['filter-in-large', property, ['literal', values.sort(compare)]];
        } else {
            return ['filter-in-small', property, ['literal', values]];
        }
    }
}

function convertHasOp(property: string) {
    switch (property) {
    case '$type':
        return true;
    case '$id':
        return [`filter-has-id`];
    default:
        return [`filter-has`, property];
    }
}

function convertNegation(filter: mixed) {
    return ['!', filter];
}
