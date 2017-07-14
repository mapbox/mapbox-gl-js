// @flow

const assert = require('assert');

const {
    typename,
    array
} = require('../types');

const { ParsingError } = require('../expression');
const { CompoundExpression, nargs } = require('../compound_expression');
const LiteralExpression = require('./literal');

class MatchExpression extends CompoundExpression {
    constructor(key: *, type: *, args: *) {
        super(key, type, args);
    }

    static opName() { return 'match'; }
    static type() { return typename('T'); }
    static signatures() { return [[typename('U'), nargs(Infinity, array(typename('U')), typename('T')), typename('T')]]; }

    static parse(args, context) {
        if (args.length < 2)
            throw new ParsingError(context.key, `Expected at least 2 arguments, but found only ${args.length}.`);

        const normalizedArgs = [args[0]];

        // parse input/output pairs.
        for (let i = 1; i < args.length - 1; i++) {
            const arg = args[i];
            if (i % 2 === 1) {
                // Match inputs are provided as either a literal value or a
                // raw JSON array of literals.  Normalize these by wrapping
                // them in an array literal `['literal', [...values]]`.
                const inputGroup = Array.isArray(arg) ? arg : [arg];
                if (inputGroup.length === 0)
                    throw new ParsingError(`${context.key}[${i + 1}]`, 'Expected at least one input value.');
                for (let j = 0; j < inputGroup.length; j++) {
                    const inputValue = inputGroup[j];
                    if (typeof inputValue === 'object')
                        throw new ParsingError(
                            `${context.key}[${i + 1}][${j}]`,
                            'Match inputs must be literal primitive values or arrays of literal primitive values.'

                        );
                }
                normalizedArgs.push(['literal', inputGroup]);
            } else {
                normalizedArgs.push(arg);
            }
        }

        normalizedArgs.push(args[args.length - 1]);

        return super.parse(normalizedArgs, context);
    }

    compileFromArgs(compiledArgs: Array<string>) {
        const input = compiledArgs[0];
        const inputs: Array<LiteralExpression> = [];
        const outputs = [];
        for (let i = 1; i < this.args.length - 1; i++) {
            if (i % 2 === 1) {
                assert(this.args[i] instanceof LiteralExpression);
                inputs.push((this.args[i] : any));
            } else {
                outputs.push(`function () { return ${compiledArgs[i]} }.bind(this)`);
            }
        }

        // 'otherwise' case
        outputs.push(`function () { return ${compiledArgs[compiledArgs.length - 1]} }.bind(this)`);

        // Construct a hash from input values (tagged with their type, to
        // distinguish e.g. 0 from "0") to the index of the corresponding
        // output. At evaluation time, look up this index and invoke the
        // (thunked) output expression.
        const inputMap = {};
        for (let i = 0; i < inputs.length; i++) {
            assert(typeof inputs[i] === 'object' && Array.isArray(inputs[i].value));
            const values: Array<number|string|boolean> = (inputs[i].value: any);
            for (const value of values) {
                const type = typeof value;
                inputMap[`${type}-${String(value)}`] = i;
            }
        }

        return `(function () {
            var outputs = [${outputs.join(', ')}];
            var inputMap = ${JSON.stringify(inputMap)};
            var input = ${input};
            var outputIndex = inputMap[this.typeOf(input).toLowerCase() + '-' + input];
            return typeof outputIndex === 'number' ? outputs[outputIndex]() :
                outputs[${outputs.length - 1}]();
        }.bind(this))()`;
    }
}

module.exports = MatchExpression;
