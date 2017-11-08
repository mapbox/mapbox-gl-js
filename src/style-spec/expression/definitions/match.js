// @flow

const assert = require('assert');
const { typeOf } = require('../values');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { Type } from '../types';

// Map input label values to output expression index
type Cases = {[number | string]: number};

class Match implements Expression {
    type: Type;
    inputType: Type;

    input: Expression;
    cases: Cases;
    outputs: Array<Expression>;
    otherwise: Expression;

    constructor(inputType: Type, outputType: Type, input: Expression, cases: Cases, outputs: Array<Expression>, otherwise: Expression) {
        this.inputType = inputType;
        this.type = outputType;
        this.input = input;
        this.cases = cases;
        this.outputs = outputs;
        this.otherwise = otherwise;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 5)
            return context.error(`Expected at least 4 arguments, but found only ${args.length - 1}.`);
        if (args.length % 2 !== 1)
            return context.error(`Expected an even number of arguments.`);

        let inputType;
        let outputType;
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        const cases = {};
        const outputs = [];
        for (let i = 2; i < args.length - 1; i += 2) {
            let labels = args[i];
            const value = args[i + 1];

            if (!Array.isArray(labels)) {
                labels = [labels];
            }

            const labelContext = context.concat(i);
            if (labels.length === 0) {
                return labelContext.error('Expected at least one branch label.');
            }

            for (const label of labels) {
                if (typeof label !== 'number' && typeof label !== 'string') {
                    return labelContext.error(`Branch labels must be numbers or strings.`);
                } else if (typeof label === 'number' && Math.abs(label) > Number.MAX_SAFE_INTEGER) {
                    return labelContext.error(`Branch labels must be integers no larger than ${Number.MAX_SAFE_INTEGER}.`);

                } else if (typeof label === 'number' && Math.floor(label) !== label) {
                    return labelContext.error(`Numeric branch labels must be integer values.`);

                } else if (!inputType) {
                    inputType = typeOf(label);
                } else if (labelContext.checkSubtype(inputType, typeOf(label))) {
                    return null;
                }

                if (typeof cases[String(label)] !== 'undefined') {
                    return labelContext.error('Branch labels must be unique.');
                }

                cases[String(label)] = outputs.length;
            }

            const result = context.parse(value, i, outputType);
            if (!result) return null;
            outputType = outputType || result.type;
            outputs.push(result);
        }

        const input = context.parse(args[1], 1, inputType);
        if (!input) return null;

        const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
        if (!otherwise) return null;

        assert(inputType && outputType);
        return new Match((inputType: any), (outputType: any), input, cases, outputs, otherwise);
    }

    evaluate(ctx: EvaluationContext) {
        const input = (this.input.evaluate(ctx): any);
        return (this.outputs[this.cases[input]] || this.otherwise).evaluate(ctx);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.input);
        this.outputs.forEach(fn);
        fn(this.otherwise);
    }
}

module.exports = Match;
