import {test} from '../../util/test';
import {createExpression, ZoomConstantExpression} from '../../../src/style-spec/expression';
import EvaluationContext from '../../../src/style-spec/expression/evaluation_context';
import properties from '../../../src/style/style_layer/symbol_style_layer_properties';
import {PossiblyEvaluatedPropertyValue} from '../../../src/style/properties';
import FormatSectionOverride from '../../../src/style/format_section_override';

test('evaluate', (t) => {

    t.test('override constant', (t) => {
        const defaultColor = {"r": 0, "g": 1, "b": 0, "a": 1};
        const overridenColor = {"r": 1, "g": 0, "b": 0, "a": 1};
        const overriden = new PossiblyEvaluatedPropertyValue(
            properties.paint.properties['text-color'],
            {kind: 'constant', value: defaultColor},
            {zoom: 0, zoomHistory: {}}
        );

        const override = new FormatSectionOverride(overriden);
        const ctx = new EvaluationContext();
        ctx.feature = {};
        ctx.featureState = {};
        t.deepEqual(override.evaluate(ctx), defaultColor);

        ctx.formattedSection = {textColor: overridenColor};
        t.deepEqual(override.evaluate(ctx), overridenColor);

        t.end();
    });

    t.test('override expression', (t) => {
        const warn = console.warn;
        console.warn = (_) => {};
        const defaultColor = {"r": 0, "g": 0, "b": 0, "a": 1};
        const propertyColor = {"r": 1, "g": 0, "b": 0, "a": 1};
        const overridenColor = {"r": 0, "g": 0, "b": 1, "a": 1};
        const styleExpr = createExpression(
            ["get", "color"],
            properties.paint.properties['text-color'].specification);

        const sourceExpr = new ZoomConstantExpression('source', styleExpr.value);
        const overriden = new PossiblyEvaluatedPropertyValue(
            properties.paint.properties['text-color'],
            sourceExpr,
            {zoom: 0, zoomHistory: {}}
        );

        const override = new FormatSectionOverride(overriden);
        const ctx = new EvaluationContext();
        ctx.feature = {properties: {}};
        ctx.featureState = {};

        t.deepEqual(override.evaluate(ctx), defaultColor);

        ctx.feature.properties.color = "red";
        t.deepEqual(override.evaluate(ctx), propertyColor);

        ctx.formattedSection = {textColor: overridenColor};
        t.deepEqual(override.evaluate(ctx), overridenColor);

        console.warn = warn;
        t.end();
    });

    t.end();
});
