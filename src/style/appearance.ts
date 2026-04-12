import {createExpression} from "../style-spec/expression";
import latest from "../style-spec/reference/latest";
import {PossiblyEvaluated, type ConfigOptions, Layout, type PossiblyEvaluatedPropertyValue} from "./properties";
import {getAppearanceLayoutProperties, type AppearanceLayoutProps, getAppearancePaintProperties, type AppearancePaintProps} from "./appearance_properties";

import type {Feature, FeatureState, GlobalProperties, StyleExpression} from "../style-spec/expression";
import type {AppearanceSpecification, ExpressionSpecification} from "../style-spec/types";
import type {StylePropertySpecification} from "../style-spec/style-spec";
import type ResolvedImage from "../style-spec/expression/types/resolved_image";
import type {CanonicalTileID} from "../source/tile_id";
import type EvaluationParameters from "./evaluation_parameters";
import type {ImageId} from "../style-spec/expression/types/image_id";
import type Color from "../style-spec/util/color";

export type ConditionCheckParams = {
    globals: GlobalProperties,
    feature?: Feature,
    featureState?: FeatureState,
    canonical?: CanonicalTileID,
    isHidden?: boolean
};

type AppearancePropertiesInput = Partial<Record<keyof AppearanceLayoutProps | keyof AppearancePaintProps, unknown>>;

class SymbolAppearance {
    condition: StyleExpression;
    name?: string;
    layoutProperties?: PossiblyEvaluated<AppearanceLayoutProps>;
    unevaluatedLayout?: Layout<AppearanceLayoutProps>;
    paintProperties?: PossiblyEvaluated<AppearancePaintProps>;
    unevaluatedPaint?: Layout<AppearancePaintProps>;
    private readonly _conditionSpec: AppearanceSpecification["condition"];
    private readonly _propertiesSpec: AppearancePropertiesInput | undefined;

    constructor(condition: AppearanceSpecification["condition"], name: string | undefined, properties: AppearancePropertiesInput | undefined, scope: string, options: ConfigOptions, iconImageUseTheme: string) {

        this._conditionSpec = condition;
        this._propertiesSpec = properties;

        const conditionSpec = (latest['appearance'] as Record<string, unknown>)['condition'] as StylePropertySpecification;

        const compiledExpression = createExpression(condition, conditionSpec);
        if (compiledExpression.result === 'success') {
            this.condition = compiledExpression.value;
        }
        this.name = name;

        if (properties) {
            this.layoutProperties = new PossiblyEvaluated(getAppearanceLayoutProperties());
            this.unevaluatedLayout = new Layout(getAppearanceLayoutProperties(), scope, options, iconImageUseTheme);
            this.paintProperties = new PossiblyEvaluated(getAppearancePaintProperties());
            this.unevaluatedPaint = new Layout(getAppearancePaintProperties(), scope, options, '');

            for (const property in properties) {
                if (property in this.unevaluatedLayout._values) {
                    this.unevaluatedLayout.setValue(property as keyof AppearanceLayoutProps, properties[property as keyof AppearanceLayoutProps]);
                } else if (property in this.unevaluatedPaint._values) {
                    this.unevaluatedPaint.setValue(property as keyof AppearancePaintProps, properties[property as keyof AppearancePaintProps]);
                }
            }
        }
    }

    isActive(context: ConditionCheckParams): boolean {
        if (!this.condition && context.isHidden && this.name === 'hidden') return true;
        return this.condition.evaluate(context.globals, context.feature, context.featureState, context.canonical) as boolean;
    }

    getCondition(): StyleExpression {
        return this.condition;
    }

    getName(): string {
        return this.name;
    }

    getLayoutProperty(name: keyof AppearanceLayoutProps): PossiblyEvaluatedPropertyValue<ResolvedImage> | PossiblyEvaluatedPropertyValue<number> | PossiblyEvaluatedPropertyValue<[number, number]> {
        return this.layoutProperties.get(name);
    }

    getPaintProperty(name: keyof AppearancePaintProps): PossiblyEvaluatedPropertyValue<Color> | PossiblyEvaluatedPropertyValue<number> | PossiblyEvaluatedPropertyValue<string> | PossiblyEvaluatedPropertyValue<[number, number]> {
        return this.paintProperties.get(name);
    }

    getUnevaluatedLayoutProperties(): Layout<AppearanceLayoutProps> {
        return this.unevaluatedLayout;
    }

    getUnevaluatedLayoutProperty(name: keyof AppearanceLayoutProps) {
        return this.unevaluatedLayout._values[name];
    }

    getUnevaluatedPaintProperty(name: keyof AppearancePaintProps) {
        return this.unevaluatedPaint._values[name];
    }

    recalculate(parameters: EvaluationParameters, availableImages: ImageId[], iconImageUseTheme?: string) {
        if (this.unevaluatedLayout) {
            (this as {layoutProperties: PossiblyEvaluated<AppearanceLayoutProps>}).layoutProperties = this.unevaluatedLayout.possiblyEvaluate(parameters, undefined, availableImages, iconImageUseTheme);
        }
        if (this.unevaluatedPaint) {
            (this as {paintProperties: PossiblyEvaluated<AppearancePaintProps>}).paintProperties = this.unevaluatedPaint.possiblyEvaluate(parameters, undefined, availableImages, '');
        }
    }

    serialize(): AppearanceSpecification {
        const result = {} as AppearanceSpecification;

        result['condition'] = this.condition.expression.serialize() as ExpressionSpecification;
        if (this.name) result['name'] = this.name;

        const layoutSerialized = this.unevaluatedLayout ? this.unevaluatedLayout.serialize() : {};
        const paintSerialized = this.unevaluatedPaint ? this.unevaluatedPaint.serialize() : {};
        const merged = Object.assign({}, layoutSerialized, paintSerialized);
        if (Object.keys(merged).length > 0) {
            result['properties'] = merged;
        }

        return result;
    }

    hasIconLayoutProperties() {
        const iconImageProperty = this.hasLayoutProperty('icon-image');
        const iconSizeProperty = this.hasLayoutProperty('icon-size');
        const iconOffsetProperty = this.hasLayoutProperty('icon-offset');
        const iconRotateProperty = this.hasLayoutProperty('icon-rotate');

        return (iconImageProperty || iconSizeProperty || iconOffsetProperty || iconRotateProperty);
    }

    hasTextLayoutProperties() {
        const textSizeProperty = this.hasLayoutProperty('text-size');
        const textOffsetProperty = this.hasLayoutProperty('text-offset');
        const textRotateProperty = this.hasLayoutProperty('text-rotate');

        return (textSizeProperty || textOffsetProperty || textRotateProperty);
    }

    hasIconPaintProperties() {
        if (!this.unevaluatedPaint) return false;
        // Iterate appearance-only paint keys (excludes -use-theme secondaries).
        // symbol-z-offset is shared between icon and text — included in both checks intentionally.
        return (Object.keys(this.unevaluatedPaint._values) as Array<keyof AppearancePaintProps>)
            .filter(k => !k.endsWith('-use-theme'))
            .some(k => (k.startsWith('icon-') || k === 'symbol-z-offset') && this.hasPaintProperty(k));
    }

    hasTextPaintProperties() {
        if (!this.unevaluatedPaint) return false;
        // Iterate appearance-only paint keys (excludes -use-theme secondaries).
        // symbol-z-offset is shared between icon and text — included in both checks intentionally.
        return (Object.keys(this.unevaluatedPaint._values) as Array<keyof AppearancePaintProps>)
            .filter(k => !k.endsWith('-use-theme'))
            .some(k => (k.startsWith('text-') || k === 'symbol-z-offset') && this.hasPaintProperty(k));
    }

    hasLayoutProperty(name: keyof AppearanceLayoutProps) {
        return this.unevaluatedLayout && this.unevaluatedLayout._values[name].value !== undefined;
    }

    hasPaintProperty(name: keyof AppearancePaintProps) {
        return this.unevaluatedPaint && this.unevaluatedPaint._values[name].value !== undefined;
    }
}

export default SymbolAppearance;
