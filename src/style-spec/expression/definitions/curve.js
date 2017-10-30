// @flow

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

class Curve implements Expression {
    key: string;
    type: Type;

    static parse(args: Array<mixed>, context: ParsingContext) {
        const [ , interpolation, input, ...rest] = args;
        if ((interpolation: any)[0] === "step") {
            return context.error(`"curve" has been replaced by "step" and "interpolate". Replace this expression with ${
                JSON.stringify(["step", input, ...rest])}`, 0);
        } else {
            return context.error(`"curve" has been replaced by "step" and "interpolate". Replace this expression with ${
                JSON.stringify(["interpolate", interpolation, input, ...rest])}`, 0);
        }
    }

    evaluate() {}
    eachChild() {}
}

module.exports = Curve;
