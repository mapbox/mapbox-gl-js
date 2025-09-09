import {createExpression} from "../style-spec/expression";
import latest from "../style-spec/reference/latest";
import {PossiblyEvaluated, type ConfigOptions, Layout, type PossiblyEvaluatedPropertyValue} from "./properties";
import {getAppearanceProperties, type AppearanceProps} from "./appearance_properties";

import type {Feature, FeatureState, GlobalProperties, StyleExpression} from "../style-spec/expression";
import type {AppearanceSpecification, ExpressionSpecification} from "../style-spec/types";
import type ResolvedImage from "../style-spec/expression/types/resolved_image";
import type {CanonicalTileID} from "../source/tile_id";

export type ConditionCheckParams = {
    globals: GlobalProperties,
    feature?: Feature,
    featureState?: FeatureState,
    canonical?: CanonicalTileID,
    isHidden?: boolean
};

class SymbolAppearance {
    condition: StyleExpression;
    name?: string;
    properties?: PossiblyEvaluated<AppearanceProps>;
    unevaluatedLayout?: Layout<AppearanceProps>;

    constructor(condition: AppearanceSpecification["condition"], name: string | undefined, properties: AppearanceProps | undefined, scope: string, options: ConfigOptions, iconImageUseTheme: string) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const conditionSpec = latest['appearance']['condition'];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const compiledExpression = createExpression(condition, conditionSpec);
        if (compiledExpression.result === 'success') {
            this.condition = compiledExpression.value;
        }
        this.name = name;

        if (properties) {
            this.properties = new PossiblyEvaluated(getAppearanceProperties());
            // For now, we only have layout properties so we can store them here but we'll need to change this when
            // supporting paint properties
            this.unevaluatedLayout = new Layout(getAppearanceProperties(), scope, options, iconImageUseTheme);
            for (const property in properties) {
                this.unevaluatedLayout.setValue(property as keyof AppearanceProps, properties[property]);
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

    getProperty(name: keyof AppearanceProps): PossiblyEvaluatedPropertyValue<ResolvedImage> | PossiblyEvaluatedPropertyValue<number> | PossiblyEvaluatedPropertyValue<[number, number]> {
        return this.properties.get(name);
    }

    getUnevaluatedProperties(): Layout<AppearanceProps> {
        return this.unevaluatedLayout;
    }

    serialize(): AppearanceSpecification {
        const result = {} as AppearanceSpecification;

        result['condition'] = this.condition.expression.serialize() as ExpressionSpecification;
        if (this.name) result['name'] = this.name;
        if (this.properties) result['properties'] = this.properties;

        return result;
    }
}

export default SymbolAppearance;
