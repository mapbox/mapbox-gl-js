// @flow

import assert from 'assert';
import type {Expression} from '../expression';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';
import type {ZoomConstantExpression} from '../../expression';
import {NullType} from '../types';
import {PossiblyEvaluatedPropertyValue} from '../../../style/properties';
import {register} from '../../../util/web_worker_transfer';

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
