// @flow

const assert = require('assert');
const {
    NullType,
    NumberType,
    ColorType,
    typename
} = require('../types');

const {
    ParsingError,
    LambdaExpression,
    nargs
} = require('../expression');

const LiteralExpression = require('./literal');

import type { Expression } from '../expression';
import type { Type } from '../types';

export type InterpolationType =
    { name: 'step' } |
    { name: 'linear' } |
    { name: 'exponential', base: number }

class CurveExpression extends LambdaExpression {
    interpolation: InterpolationType;
    constructor(key: *, type: *, args: *, interpolation: InterpolationType) {
        super(key, type, args);
        this.interpolation = interpolation;
    }

    static opName() { return 'curve'; }
    static type() { return typename('T'); }
    static signatures() { return [[NullType, NumberType, nargs(Infinity, NumberType, typename('T'))]]; }

    static parse(args, context) {
        // pull out the interpolation type argument for specialized parsing,
        // and replace it with `null` so that other arguments' "key"s stay the
        // same for error reporting.
        const interp = args[0];
        const fixedArgs = [null].concat(args.slice(1));
        const expression: CurveExpression = (super.parse(fixedArgs, context): any);

        if (!Array.isArray(interp) || interp.length === 0)
            throw new ParsingError(`${context.key}[1]`, `Expected an interpolation type expression, but found ${String(interp)} instead.`);

        if (interp[0] === 'step') {
            expression.interpolation = { name: 'step' };
        } else if (interp[0] === 'linear') {
            expression.interpolation = { name: 'linear' };
        } else if (interp[0] === 'exponential') {
            const base = interp[1];
            if (typeof base !== 'number')
                throw new ParsingError(`${context.key}[1][1]`, `Exponential interpolation requires a numeric base.`);
            expression.interpolation = {
                name: 'exponential',
                base
            };
        } else throw new ParsingError(`${context.key}[1][0]`, `Unknown interpolation type ${String(interp[0])}`);
        return expression;
    }

    serialize() {
        const args = this.args.map(e => e.serialize());
        const interp = [this.interpolation.name];
        if (this.interpolation.name === 'exponential') {
            interp.push(this.interpolation.base);
        }
        args.splice(0, 1, interp);
        return [ `curve` ].concat(args);
    }

    applyType(type: Type, args: Array<Expression>): Expression {
        return new this.constructor(this.key, type, args, this.interpolation);
    }

    compileFromArgs(compiledArgs: Array<string>) {
        assert(this.args.length === compiledArgs.length);
        if (compiledArgs.length < 4) return [{
            key: this.key,
            error: `Expected at least four arguments, but found only ${compiledArgs.length}.`
        }];

        let firstOutputType = this.args[3].type;
        if (firstOutputType.kind === 'lambda') {
            firstOutputType = firstOutputType.result;
        }
        let resultType;
        if (firstOutputType === NumberType) {
            resultType = 'number';
        } else if (firstOutputType === ColorType) {
            resultType = 'color';
        } else if (
            firstOutputType.kind === 'array' &&
            firstOutputType.itemType === NumberType
        ) {
            resultType = 'array';
        } else if (this.interpolation.name !== 'step') {
            return [{
                key: this.args[3].key,
                error: `Type ${firstOutputType.name} is not interpolatable, and thus cannot be used as a ${this.interpolation.name} curve's output type.`
            }];
        }

        const stops = [];
        const outputs = [];
        for (let i = 2; (i + 1) < this.args.length; i += 2) {
            const input = this.args[i];
            if (
                !(input instanceof LiteralExpression) ||
                typeof input.value !== 'number'
            ) {
                return [{ key: this.args[i].key, error: 'Input/output pairs for "curve" expressions must be defined using literal numeric values (not computed expressions) for the input values.' }];
            }

            if (stops.length && stops[stops.length - 1] > input.value) {
                return [{ key: this.args[i].key, error: 'Input/output pairs for "curve" expressions must be arranged with input values in strictly ascending order.' }];
            }

            stops.push(input.value);

            outputs.push(compiledArgs[i + 1]);
        }

        return `(function () {
            var input = ${compiledArgs[1]};
            var stopInputs = [${stops.join(', ')}];
            var stopOutputs = [${outputs.map(o => `function () { return ${o}; }.bind(this)`).join(', ')}];
            return this.evaluateCurve(input, stopInputs, stopOutputs, ${JSON.stringify(this.interpolation)}, ${JSON.stringify(resultType)});
        }.bind(this))()`;
    }
}

module.exports = CurveExpression;
