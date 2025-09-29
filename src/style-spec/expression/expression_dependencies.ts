import CompoundExpression from "./compound_expression";
import Config from "./definitions/config";

import type {Expression} from "./expression";

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

function isIndoorDependent(e: Expression): boolean {
    if (e instanceof CompoundExpression && e.name === 'is-active-floor') {
        return true;
    }

    let result = false;
    e.eachChild(arg => {
        if (!result && isIndoorDependent(arg)) {
            result = true;
        }
    });
    return result;
}

export {getConfigDependencies, isIndoorDependent};
