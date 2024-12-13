import {mat4} from 'gl-matrix';
import StyleLayer from '../style_layer';
import assert from 'assert';
import SymbolBucket from '../../data/bucket/symbol_bucket';
import resolveTokens from '../../util/resolve_tokens';
import {getLayoutProperties, getPaintProperties} from './symbol_style_layer_properties';
import {computeColorAdjustmentMatrix} from '../../util/util';
import {
    PossiblyEvaluatedPropertyValue
} from '../properties';
import {
    isExpression,
    StyleExpression,
    ZoomConstantExpression,
    ZoomDependentExpression
} from '../../style-spec/expression/index';
import {FormattedType} from '../../style-spec/expression/types';
import {typeOf} from '../../style-spec/expression/values';
import Formatted from '../../style-spec/expression/types/formatted';
import FormatSectionOverride from '../format_section_override';
import FormatExpression from '../../style-spec/expression/definitions/format';
import Literal from '../../style-spec/expression/definitions/literal';
import ProgramConfiguration from '../../data/program_configuration';

import type {FormattedSection} from '../../style-spec/expression/types/formatted';
import type {FormattedSectionExpression} from '../../style-spec/expression/definitions/format';
import type {CreateProgramParams} from '../../render/painter';
import type {ConfigOptions, Properties,
    Transitionable,
    Transitioning,
    Layout,
    PossiblyEvaluated,
    PropertyValue
} from '../properties';
import type {BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './symbol_style_layer_properties';
import type EvaluationParameters from '../evaluation_parameters';
import type {LayerSpecification} from '../../style-spec/types';
import type {Feature, SourceExpression, CompositeExpression} from '../../style-spec/expression/index';
import type {Expression} from '../../style-spec/expression/expression';
import type {CanonicalTileID} from '../../source/tile_id';
import type {LUT} from "../../util/lut";

let properties: {
    layout: Properties<LayoutProps>;
    paint: Properties<PaintProps>;
};

const getProperties = () => {
    if (properties) {
        return properties;
    }

    properties = {
        layout: getLayoutProperties(),
        paint: getPaintProperties()
    };

    return properties;
};

class SymbolStyleLayer extends StyleLayer {
    override _unevaluatedLayout: Layout<LayoutProps>;
    override layout: PossiblyEvaluated<LayoutProps>;

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    _colorAdjustmentMatrix: mat4;
    _saturation: number;
    _contrast: number;
    _brightnessMin: number;
    _brightnessMax: number;

    hasInitialOcclusionOpacityProperties: boolean;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, getProperties(), scope, lut, options);
        this._colorAdjustmentMatrix = mat4.identity([] as unknown as mat4);
        this.hasInitialOcclusionOpacityProperties = (layer.paint !== undefined) && (('icon-occlusion-opacity' in layer.paint) || ('text-occlusion-opacity' in layer.paint));
    }

    override recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        if (this.layout.get('icon-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                this.layout._values['icon-rotation-alignment'] = 'map';
            } else {
                this.layout._values['icon-rotation-alignment'] = 'viewport';
            }
        }

        if (this.layout.get('text-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                this.layout._values['text-rotation-alignment'] = 'map';
            } else {
                this.layout._values['text-rotation-alignment'] = 'viewport';
            }
        }

        // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
        if (this.layout.get('text-pitch-alignment') === 'auto') {
            this.layout._values['text-pitch-alignment'] = this.layout.get('text-rotation-alignment');
        }
        if (this.layout.get('icon-pitch-alignment') === 'auto') {
            this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment');
        }

        const writingModes = this.layout.get('text-writing-mode');
        if (writingModes) {
            // remove duplicates, preserving order
            const deduped = [];

            for (const m of writingModes) {
                if (deduped.indexOf(m) < 0) deduped.push(m);
            }
            this.layout._values['text-writing-mode'] = deduped;
        } else if (this.layout.get('symbol-placement') === 'point') {
            // default value for 'point' placement symbols
            this.layout._values['text-writing-mode'] = ['horizontal'];
        } else {
            // default value for 'line' placement symbols
            this.layout._values['text-writing-mode'] = ['horizontal', 'vertical'];
        }

        this._setPaintOverrides();
    }

    getColorAdjustmentMatrix(
        saturation: number,
        contrast: number,
        brightnessMin: number,
        brightnessMax: number,
    ): mat4 {
        if (this._saturation !== saturation ||
            this._contrast !== contrast ||
            this._brightnessMin !== brightnessMin ||
            this._brightnessMax !== brightnessMax) {

            this._colorAdjustmentMatrix = computeColorAdjustmentMatrix(saturation, contrast, brightnessMin, brightnessMax);

            this._saturation = saturation;
            this._contrast = contrast;
            this._brightnessMin = brightnessMin;
            this._brightnessMax = brightnessMax;
        }
        return this._colorAdjustmentMatrix;
    }

    getValueAndResolveTokens(
        name: any,
        feature: Feature,
        canonical: CanonicalTileID,
        availableImages: Array<string>,
    ): string {
        const value = this.layout.get(name).evaluate(feature, {}, canonical, availableImages);
        const unevaluated = this._unevaluatedLayout._values[name];
        if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value) && value) {
            return resolveTokens(feature.properties, value);
        }

        return value;
    }

    createBucket(parameters: BucketParameters<SymbolStyleLayer>): SymbolBucket {
        return new SymbolBucket(parameters);
    }

    override queryRadius(): number {
        return 0;
    }

    override queryIntersectsFeature(): boolean {
        assert(false); // Should take a different path in FeatureIndex
        return false;
    }

    _setPaintOverrides() {
        for (const overridable of getProperties().paint.overridableProperties) {
            if (!SymbolStyleLayer.hasPaintOverride(this.layout, overridable)) {
                continue;
            }
            // @ts-expect-error - TS2345 - Argument of type 'string' is not assignable to parameter of type 'keyof PaintProps'.
            const overriden = this.paint.get(overridable);
            // @ts-expect-error - TS2345 - Argument of type 'unknown' is not assignable to parameter of type 'PossiblyEvaluatedPropertyValue<unknown>'.
            const override = new FormatSectionOverride(overriden);
            // @ts-expect-error - TS2339 - Property 'property' does not exist on type 'unknown'.
            const styleExpression = new StyleExpression(override, overriden.property.specification, this.scope, this.options);
            let expression = null;
            // eslint-disable-next-line no-warning-comments
            // TODO: check why were the `isLightConstant` values omitted from the construction of these expressions
            // @ts-expect-error - TS2339 - Property 'value' does not exist on type 'unknown'. | TS2339 - Property 'value' does not exist on type 'unknown'.
            if (overriden.value.kind === 'constant' || overriden.value.kind === 'source') {
                expression = (new ZoomConstantExpression('source', styleExpression) as SourceExpression);
            } else {
                expression = (new ZoomDependentExpression('composite',
                                                          styleExpression,
                                                          // @ts-expect-error - TS2339 - Property 'value' does not exist on type 'unknown'.
                                                          overriden.value.zoomStops,
                                                          // @ts-expect-error - TS2339 - Property 'value' does not exist on type 'unknown'.
                                                          overriden.value._interpolationType) as CompositeExpression);
            }
            // @ts-expect-error - TS2339 - Property 'property' does not exist on type 'unknown'.
            this.paint._values[overridable] = new PossiblyEvaluatedPropertyValue(overriden.property,
                                                                                 expression,
                                                                                 // @ts-expect-error - TS2339 - Property 'parameters' does not exist on type 'unknown'.
                                                                                 overriden.parameters);
        }
    }

    override _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (!this.layout || oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        return SymbolStyleLayer.hasPaintOverride(this.layout, name);
    }

    static hasPaintOverride(layout: PossiblyEvaluated<LayoutProps>, propertyName: string): boolean {
        const textField = layout.get('text-field');
        const property = getProperties().paint.properties[propertyName];
        let hasOverrides = false;

        const checkSections = (sections: Array<FormattedSection> | Array<FormattedSectionExpression>) => {
            for (const section of sections) {
                if (property.overrides && property.overrides.hasOverride(section)) {
                    hasOverrides = true;
                    return;
                }
            }
        };

        if (textField.value.kind === 'constant' && textField.value.value instanceof Formatted) {

            checkSections(textField.value.value.sections);

        } else if (textField.value.kind === 'source') {

            const checkExpression = (expression: Expression) => {
                if (hasOverrides) return;

                if (expression instanceof Literal && typeOf(expression.value) === FormattedType) {
                    const formatted: Formatted = ((expression.value) as any);
                    checkSections(formatted.sections);
                } else if (expression instanceof FormatExpression) {
                    checkSections(expression.sections);
                } else {
                    expression.eachChild(checkExpression);
                }
            };

            const expr: ZoomConstantExpression<'source'> = ((textField.value) as any);
            if (expr._styleExpression) {
                checkExpression(expr._styleExpression.expression);
            }
        }

        return hasOverrides;
    }

    override getProgramIds(): string[] {
        return ['symbol'];
    }

    override getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        return {
            config: new ProgramConfiguration(this, {zoom, lut}),
            overrideFog: false
        };
    }
}

export default SymbolStyleLayer;
