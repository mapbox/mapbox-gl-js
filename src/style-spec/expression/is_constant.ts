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
        } else if (/^filter-/.test(e.name)) {
            return false;
        }
    }

    if (e instanceof Within) {
        return false;
    }

    if (e instanceof Distance) {
        return false;
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

function getConfigDependencies(e: Expression): Set<string> {
    if (e instanceof Config) {
        const singleConfig = new Set([e.key]);
        return singleConfig;
    }

    let result = new Set<string>();
    e.eachChild(arg => {
        result = new Set([...result, ...getConfigDependencies(arg)]);
    });
    return result;
}

function isGlobalPropertyConstant(e: Expression, properties: Array<string>): boolean {
    if (e instanceof CompoundExpression && properties.indexOf(e.name) >= 0) { return false; }
    let result = true;
    e.eachChild((arg) => {
        if (result && !isGlobalPropertyConstant(arg, properties)) { result = false; }
    });
    return result;
}

export {isFeatureConstant, isGlobalPropertyConstant, isStateConstant, getConfigDependencies};
