// @flow

import styleSpec from '../../src/style-spec/reference/latest.js';
import type {LightsSpecification} from '../../src/style-spec/types.js';
import {Evented} from '../../src/util/evented.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated} from '../../src/style/properties.js';
import type {TransitionParameters} from '../../src/style/properties.js';
import type EvaluationParameters from '../../src/style/evaluation_parameters.js';

class Lights<P: Object> extends Evented {
    _transitionable: Transitionable<P>;
    _transitioning: Transitioning<P>;
    properties: PossiblyEvaluated<P>;
    _options: LightsSpecification;

    constructor(options: LightsSpecification, properties: Properties<P>) {
        super();
        this._options = options;
        this._transitionable = new Transitionable(properties);
        this._transitionable.setTransitionOrValue(options.properties);
        this._transitioning = this._transitionable.untransitioned();
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
}

export default Lights;