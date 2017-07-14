'use strict';

const test = require('mapbox-gl-js-test').test;
const {
    StringType,
    NumberType,
    typename,
    lambda,
    variant
} = require('../../../../src/style-spec/function/types');
const {
    parseExpression,
    ParsingContext,
    LambdaExpression,
    Scope
} = require('../../../../src/style-spec/function/expression');
const LiteralExpression = require('../../../../src/style-spec/function/definitions/literal');

function createParse(types) {
    const definitions = {
        'literal': LiteralExpression
    };
    for (const fn in types) {
        definitions[fn] = class extends LambdaExpression {
            static getName() { return fn; }
            static getType() { return types[fn]; }
        };
    }
    return (expr) => parseExpression(expr, new ParsingContext(definitions));
}

function typecheck(expectedType, expression) {
    return expression.typecheck(expectedType, new Scope());
}

test('typecheck expressions', (t) => {
    t.test('literal', (t) => {
        const parse = createParse({});
        const result = typecheck(StringType, parse('hello'));
        t.deepEqual(result.expression.type, StringType);
        t.end();
    });

    t.test('literal wrong type', (t) => {
        const parse = createParse({});
        const result = typecheck(StringType, parse(1));
        t.ok(result.errors);
        t.end();
    });

    t.test('check value tagged with non-generic lambda type', (t) => {
        const parse = createParse({fn: lambda(NumberType, StringType)});
        const value = parse([ 'fn', '' ]);

        const expectedType = lambda(NumberType, StringType);
        t.deepEqual(typecheck(NumberType, value).expression.type, expectedType);

        t.deepEqual(typecheck(lambda(NumberType, StringType), value).expression.type, expectedType);
        t.deepEqual(typecheck(lambda(typename('T'), StringType), value).expression.type, expectedType);
        t.deepEqual(typecheck(lambda(NumberType, typename('U')), value).expression.type, expectedType);

        // TBD
        // t.deepEqual(typecheck(lambda(variant(NumberType, StringType), StringType), value), value);

        t.ok(typecheck(lambda(StringType, StringType), value).errors);
        t.ok(typecheck(lambda(NumberType, NumberType), value).errors);
        t.end();
    });

    t.test('check value tagged with lambda type having generic result type', (t) => {
        const parse = createParse({fn: lambda(typename('T'), StringType)});
        const value = parse(['fn', '']);

        t.deepEqual(
            typecheck(NumberType, value).expression.type,
            lambda(NumberType, StringType)
        );

        t.deepEqual(
            typecheck(StringType, value).expression.type,
            lambda(StringType, StringType)
        );

        t.deepEqual(
            typecheck(lambda(NumberType, StringType), value).expression.type,
            lambda(NumberType, StringType)
        );

        t.deepEqual(
            typecheck(lambda(NumberType, typename('T')), value).expression.type,
            lambda(NumberType, StringType)
        );

        t.equal(
            typecheck(lambda(variant(NumberType, StringType), StringType), value).expression.type.name,
            lambda(variant(NumberType, StringType), StringType).name
        );

        t.ok(typecheck(lambda(StringType, NumberType), value).errors);
        t.end();
    });

    t.test('check value tagged with lambda type having generic input and result type', (t) => {
        const parse = createParse({fn: lambda(typename('T'), typename('T'), StringType)});
        let value = parse(['fn', 0, '']);

        t.deepEqual(
            typecheck(NumberType, value).expression.type,
            lambda(NumberType, NumberType, StringType)
        );

        t.ok(typecheck(StringType, value).errors);

        value = parse(['fn', '', '']);
        t.deepEqual(
            typecheck(StringType, value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        t.deepEqual(
            typecheck(lambda(StringType, StringType, StringType), value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        t.deepEqual(
            typecheck(lambda(typename('T'), typename('T'), StringType), value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        t.deepEqual(
            typecheck(lambda(typename('U'), typename('U'), StringType), value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        t.deepEqual(
            typecheck(typename('T'), value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        t.deepEqual(
            typecheck(typename('U'), value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        t.end();
    });

    t.test('check value tagged with lambda type having generic input and result type, and a nested generic argument value', (t) => {
        const parse = createParse({
            fn: lambda(typename('T'), typename('T'), StringType),
            fn2: lambda(typename('T'), typename('T')),
            fn3: lambda(typename('U'), typename('U')),
        });

        let value = parse(['fn', ['fn2', ''], '']);
        const result = typecheck(StringType, value).expression;
        t.deepEqual(result.type, lambda(StringType, StringType, StringType));
        t.deepEqual(result.args[0].type, lambda(StringType, StringType));

        value = parse(['fn', ['fn3', ''], '']);

        t.deepEqual(
            typecheck(StringType, value).expression.type,
            lambda(StringType, StringType, StringType)
        );

        value = parse(['fn', ['fn3', 0], '']);

        t.ok(typecheck(StringType, value).errors);
        t.deepEqual(
            typecheck(NumberType, value).expression.type,
            lambda(NumberType, NumberType, StringType)
        );

        t.ok(
            typecheck(typename('T'), value).errors,
            'Type inference does not look ahead more than one level in the AST'
        );

        t.end();
    });

    t.end();
});
