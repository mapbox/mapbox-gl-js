import CompoundExpression from "./compound_expression";
import Config from "./definitions/config";

import type {Expression} from "./expression";

export type ExpressionDependencies = {
    configDependencies: Set<string>;
    isIndoorDependent: boolean;
};

// Shared by every expression without config dependencies, which is the vast majority; read-only.
const NO_CONFIG_DEPENDENCIES: Set<string> = new Set();

function collect(e: Expression, deps: ExpressionDependencies) {
    if (e instanceof Config) {
        if (deps.configDependencies === NO_CONFIG_DEPENDENCIES) deps.configDependencies = new Set();
        deps.configDependencies.add(e.key);
        return; // `Config.eachChild` is a no-op
    }
    if (e instanceof CompoundExpression && e.name === 'is-active-floor') deps.isIndoorDependent = true;
    e.eachChild(arg => { collect(arg, deps); });
}

// One traversal for both dependency kinds, and no per-node allocation: this runs for every
// expression of every property of every layer at style load, so the walk dominates what it finds.
export function getExpressionDependencies(e: Expression): ExpressionDependencies {
    const deps = {configDependencies: NO_CONFIG_DEPENDENCIES, isIndoorDependent: false};
    collect(e, deps);
    return deps;
}
