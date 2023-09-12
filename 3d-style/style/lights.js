// @flow

import type {LightsSpecification} from '../../src/style-spec/types.js';
import type {Expression} from '../../src/style-spec/expression/expression.js';
import {Evented} from '../../src/util/evented.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated} from '../../src/style/properties.js';
import type {TransitionParameters} from '../../src/style/properties.js';
import type EvaluationParameters from '../../src/style/evaluation_parameters.js';

class Lights<P: Object> extends Evented {
    scope: string;
    properties: PossiblyEvaluated<P>;
    _transitionable: Transitionable<P>;
    _transitioning: Transitioning<P>;
    _options: LightsSpecification;

    constructor(options: LightsSpecification, properties: Properties<P>, scope: string, configOptions?: ?Map<string, Expression>) {
        super();
        this.scope = scope;
        this._options = options;
        this.properties = new PossiblyEvaluated(properties);

        this._transitionable = new Transitionable(properties, new Map(configOptions));
        this._transitionable.setTransitionOrValue<LightsSpecification['properties']>(options.properties);
        this._transitioning = this._transitionable.untransitioned();
    }

    updateConfig(configOptions?: ?Map<string, Expression>) {
        this._transitionable.setTransitionOrValue<LightsSpecification['properties']>(this._options.properties, new Map(configOptions));
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition(): boolean {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    get(): LightsSpecification {
        this._options.properties = (this._transitionable.serialize(): any);
        return this._options;
    }

    set(options: LightsSpecification, configOptions?: ?Map<string, Expression>) {
        this._options = options;
        this._transitionable.setTransitionOrValue<LightsSpecification['properties']>(options.properties, configOptions);
    }

    shadowsEnabled(): boolean {
        if (!this.properties) return false;
        return this.properties.get('cast-shadows') === true;
    }
}

export default Lights;
