// @flow

import assert from 'assert';
import type {Expression} from '../style-spec/expression/expression.js';
import type EvaluationContext from '../style-spec/expression/evaluation_context.js';
import type {Type} from '../style-spec/expression/types.js';
import type {ZoomConstantExpression} from '../style-spec/expression/index.js';
import {NullType} from '../style-spec/expression/types.js';
import {PossiblyEvaluatedPropertyValue} from './properties.js';
import {register} from '../util/web_worker_transfer.js';

// This is an internal expression class. It is only used in GL JS and
// has GL JS dependencies which can break the standalone style-spec module
export default class FormatSectionOverride<T> implements Expression {
    type: Type;
    defaultValue: PossiblyEvaluatedPropertyValue<T>;

    constructor(defaultValue: PossiblyEvaluatedPropertyValue<T>) {
        assert(defaultValue.property.overrides !== undefined);
        this.type = defaultValue.property.overrides ? defaultValue.property.overrides.runtimeType : NullType;
        this.defaultValue = defaultValue;
    }

    evaluate(ctx: EvaluationContext) {
        if (ctx.formattedSection) {
            const overrides = this.defaultValue.property.overrides;
            if (overrides && overrides.hasOverride(ctx.formattedSection)) {
                return overrides.getOverride(ctx.formattedSection);
            }
        }

        if (ctx.feature && ctx.featureState) {
            return this.defaultValue.evaluate(ctx.feature, ctx.featureState);
        }

        return this.defaultValue.property.specification.default;
    }

    eachChild(fn: (_: Expression) => void) {
        if (!this.defaultValue.isConstant()) {
            const expr: ZoomConstantExpression<'source'> = ((this.defaultValue.value): any);
            fn(expr._styleExpression.expression);
        }
    }

    // Cannot be statically evaluated, as the output depends on the evaluation context.
    outputDefined() {
        return false;
    }

    serialize() {
        return null;
    }
}

register('FormatSectionOverride', FormatSectionOverride, {omit: ['defaultValue']});
