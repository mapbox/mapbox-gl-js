import assert from 'assert';
import {NullType} from '../style-spec/expression/types';
import {register} from '../util/web_worker_transfer';

import type {Expression} from '../style-spec/expression/expression';
import type EvaluationContext from '../style-spec/expression/evaluation_context';
import type {Type} from '../style-spec/expression/types';
import type {ZoomConstantExpression} from '../style-spec/expression/index';
import type {PossiblyEvaluatedPropertyValue} from './properties';

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

    evaluate(ctx: EvaluationContext): T {
        if (ctx.formattedSection) {
            const overrides = this.defaultValue.property.overrides;
            if (overrides && overrides.hasOverride(ctx.formattedSection)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return overrides.getOverride(ctx.formattedSection);
            }
        }

        if (ctx.feature && ctx.featureState) {
            return this.defaultValue.evaluate(ctx.feature, ctx.featureState);
        }

        // not sure how to make Flow refine the type properly here — will need investigation
        return this.defaultValue.property.specification.default as T;
    }

    eachChild(fn: (_: Expression) => void) {
        if (!this.defaultValue.isConstant()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const expr: ZoomConstantExpression<'source'> = ((this.defaultValue.value) as any);
            fn(expr._styleExpression.expression);
        }
    }

    // Cannot be statically evaluated, as the output depends on the evaluation context.
    outputDefined(): boolean {
        return false;
    }

    serialize(): null {
        return null;
    }
}

register(FormatSectionOverride, 'FormatSectionOverride', {omit: ['defaultValue']});
