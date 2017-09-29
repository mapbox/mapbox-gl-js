// @flow

const { CompoundExpression } = require('./compound_expression');

import type { Expression } from './expression.js';

function isFeatureConstant(e: Expression) {
    if (e instanceof CompoundExpression) {
        if (e.name === 'get' && e.args.length === 1) {
            return false;
        } else if (e.name === 'has' && e.args.length === 1) {
            return false;
        } else if (
            e.name === 'properties' ||
            e.name === 'geometry-type' ||
            e.name === 'id'
        ) {
            return false;
        }
    }

    let result = true;
    e.eachChild(arg => {
        if (result && !isFeatureConstant(arg)) { result = false; }
    });
    return result;
}

function isZoomConstant(e: Expression) {
    if (e instanceof CompoundExpression && e.name === 'zoom') { return false; }
    let result = true;
    e.eachChild((arg) => {
        if (result && !isZoomConstant(arg)) { result = false; }
    });
    return result;
}

module.exports = {
    isFeatureConstant,
    isZoomConstant,
};
