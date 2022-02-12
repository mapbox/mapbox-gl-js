// @flow

import StyleLayer from '../style_layer.js';

import assert from 'assert';
import SymbolBucket from '../../data/bucket/symbol_bucket.js';
import resolveTokens from '../../util/resolve_tokens.js';
import properties from './symbol_style_layer_properties.js';

import {
    Transitionable,
    Transitioning,
    Layout,
    PossiblyEvaluated,
    PossiblyEvaluatedPropertyValue,
    PropertyValue
} from '../properties.js';

import {
    isExpression,
    StyleExpression,
    ZoomConstantExpression,
    ZoomDependentExpression
} from '../../style-spec/expression/index.js';

import type {BucketParameters} from '../../data/bucket.js';
import type {LayoutProps, PaintProps} from './symbol_style_layer_properties.js';
import type EvaluationParameters from '../evaluation_parameters.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {Feature, SourceExpression, CompositeExpression} from '../../style-spec/expression/index.js';
import type {Expression} from '../../style-spec/expression/expression.js';
import type {CanonicalTileID} from '../../source/tile_id.js';
import {FormattedType} from '../../style-spec/expression/types.js';
import {typeOf} from '../../style-spec/expression/values.js';
import Formatted from '../../style-spec/expression/types/formatted.js';
import FormatSectionOverride from '../format_section_override.js';
import FormatExpression from '../../style-spec/expression/definitions/format.js';
import Literal from '../../style-spec/expression/definitions/literal.js';
import ProgramConfiguration from '../../data/program_configuration.js';

class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
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

    getValueAndResolveTokens(name: *, feature: Feature, canonical: CanonicalTileID, availableImages: Array<string>): string {
        const value = this.layout.get(name).evaluate(feature, {}, canonical, availableImages);
        const unevaluated = this._unevaluatedLayout._values[name];
        if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value) && value) {
            return resolveTokens(feature.properties, value);
        }

        return value;
    }

    createBucket(parameters: BucketParameters<*>): SymbolBucket {
        return new SymbolBucket(parameters);
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        assert(false); // Should take a different path in FeatureIndex
        return false;
    }

    _setPaintOverrides() {
        for (const overridable of properties.paint.overridableProperties) {
            if (!SymbolStyleLayer.hasPaintOverride(this.layout, overridable)) {
                continue;
            }
            const overriden = this.paint.get(overridable);
            const override = new FormatSectionOverride(overriden);
            const styleExpression = new StyleExpression(override, overriden.property.specification);
            let expression = null;
            if (overriden.value.kind === 'constant' || overriden.value.kind === 'source') {
                expression = (new ZoomConstantExpression('source', styleExpression): SourceExpression);
            } else {
                expression = (new ZoomDependentExpression('composite',
                                                          styleExpression,
                                                          overriden.value.zoomStops,
                                                          overriden.value._interpolationType): CompositeExpression);
            }
            this.paint._values[overridable] = new PossiblyEvaluatedPropertyValue(overriden.property,
                                                                                 expression,
                                                                                 overriden.parameters);
        }
    }

    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (!this.layout || oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        return SymbolStyleLayer.hasPaintOverride(this.layout, name);
    }

    static hasPaintOverride(layout: PossiblyEvaluated<LayoutProps>, propertyName: string): boolean {
        const textField = layout.get('text-field');
        const property = properties.paint.properties[propertyName];
        let hasOverrides = false;

        const checkSections = (sections) => {
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
                    const formatted: Formatted = ((expression.value): any);
                    checkSections(formatted.sections);
                } else if (expression instanceof FormatExpression) {
                    checkSections(expression.sections);
                } else {
                    expression.eachChild(checkExpression);
                }
            };

            const expr: ZoomConstantExpression<'source'> = ((textField.value): any);
            if (expr._styleExpression) {
                checkExpression(expr._styleExpression.expression);
            }
        }

        return hasOverrides;
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }
}

export default SymbolStyleLayer;
