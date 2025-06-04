// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {createExpression, ZoomConstantExpression} from '../../../src/style-spec/expression/index';
import EvaluationContext from '../../../src/style-spec/expression/evaluation_context';
import {getPaintProperties} from '../../../src/style/style_layer/symbol_style_layer_properties';
import {PossiblyEvaluatedPropertyValue} from '../../../src/style/properties';
import FormatSectionOverride from '../../../src/style/format_section_override';

describe('evaluate', () => {
    test('override constant', () => {
        const defaultColor = {"r": 0, "g": 1, "b": 0, "a": 1};
        const overridenColor = {"r": 1, "g": 0, "b": 0, "a": 1};
        const overriden = new PossiblyEvaluatedPropertyValue(
            getPaintProperties().properties['text-color'],
            {kind: 'constant', value: defaultColor},
            {zoom: 0}
        );

        const override = new FormatSectionOverride(overriden);
        const ctx = new EvaluationContext();
        ctx.feature = {};
        ctx.featureState = {};
        expect(override.evaluate(ctx)).toEqual(defaultColor);

        ctx.formattedSection = {textColor: overridenColor};
        expect(override.evaluate(ctx)).toEqual(overridenColor);
    });

    test('override expression', () => {
        const warn = console.warn;
        console.warn = (_) => {};
        const defaultColor = {"r": 0, "g": 0, "b": 0, "a": 1};
        const propertyColor = {"r": 1, "g": 0, "b": 0, "a": 1};
        const overridenColor = {"r": 0, "g": 0, "b": 1, "a": 1};
        const styleExpr = createExpression(
            ["get", "color"],
            getPaintProperties().properties['text-color'].specification);

        const sourceExpr = new ZoomConstantExpression('source', styleExpr.value);
        const overriden = new PossiblyEvaluatedPropertyValue(
            getPaintProperties().properties['text-color'],
            sourceExpr,
            {zoom: 0}
        );

        const override = new FormatSectionOverride(overriden);
        const ctx = new EvaluationContext();
        ctx.feature = {properties: {}};
        ctx.featureState = {};

        expect(override.evaluate(ctx)).toEqual(defaultColor);

        ctx.feature.properties.color = "red";
        expect(override.evaluate(ctx)).toEqual(propertyColor);

        ctx.formattedSection = {textColor: overridenColor};
        expect(override.evaluate(ctx)).toEqual(overridenColor);

        console.warn = warn;
    });
});
