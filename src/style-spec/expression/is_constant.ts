import CompoundExpression from './compound_expression';
import Within from './definitions/within';
import Distance from './definitions/distance';
import Config from './definitions/config';

import type {Expression} from './expression';

function isFeatureConstant(e: Expression): boolean {
    if (e instanceof CompoundExpression) {
        if (e.name === 'get' && e.args.length === 1) {
            return false;
        } else if (e.name === 'feature-state') {
            return false;
        } else if (e.name === 'has' && e.args.length === 1) {
            return false;
        } else if (
            e.name === 'properties' ||
            e.name === 'geometry-type' ||
            e.name === 'id'
        ) {
            return false;
        } else if (e.name.startsWith('filter-')) {
            return false;
        }
    }

    if (e instanceof Within) {
        return false;
    }

    if (e instanceof Distance) {
        return false;
    }

    if (e instanceof Config) {
        return e.featureConstant;
    }

    let result = true;
    e.eachChild(arg => {
        if (result && !isFeatureConstant(arg)) { result = false; }
    });
    return result;
}

function isStateConstant(e: Expression): boolean {
    if (e instanceof CompoundExpression) {
        if (e.name === 'feature-state') {
            return false;
        }
    }
    let result = true;
    e.eachChild(arg => {
        if (result && !isStateConstant(arg)) { result = false; }
    });
    return result;
}

function isGlobalPropertyConstantSet(e: Expression, properties: ReadonlySet<string>): boolean {
    if (e instanceof CompoundExpression && properties.has(e.name)) { return false; }
    let result = true;
    e.eachChild((arg) => {
        if (result && !isGlobalPropertyConstantSet(arg, properties)) { result = false; }
    });
    return result;
}

function isGlobalPropertyConstant(e: Expression, properties: Array<string>): boolean {
    return isGlobalPropertyConstantSet(e, new Set(properties));
}

// Bitmask so that one walk answers all three: `createPropertyExpression` used to call
// `isGlobalPropertyConstant` once per group, traversing every expression of every property in
// full each time, since those calls only exit early on the rare dependent branch.
export const GlobalDependency = {Zoom: 1, Light: 2, LineProgress: 4};

const globalDependencyFlags: Record<string, number> = {
    'zoom': GlobalDependency.Zoom,
    'pitch': GlobalDependency.Zoom,
    'distance-from-center': GlobalDependency.Zoom,
    'measure-light': GlobalDependency.Light,
    'line-progress': GlobalDependency.LineProgress
};

function getGlobalDependencies(e: Expression): number {
    let flags = e instanceof CompoundExpression ? globalDependencyFlags[e.name] || 0 : 0;
    e.eachChild(arg => { flags |= getGlobalDependencies(arg); });
    return flags;
}

export {isFeatureConstant, isGlobalPropertyConstant, isGlobalPropertyConstantSet, isStateConstant, getGlobalDependencies};
