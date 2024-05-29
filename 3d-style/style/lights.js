// @flow

import {Evented} from '../../src/util/evented.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated} from '../../src/style/properties.js';

import type EvaluationParameters from '../../src/style/evaluation_parameters.js';
import type {LightsSpecification} from '../../src/style-spec/types.js';
import type {TransitionParameters, ConfigOptions} from '../../src/style/properties.js';
import type {LightProps as FlatLightProps} from './flat_light_properties.js';
import type {LightProps as AmbientLightProps} from './ambient_light_properties.js';
import type {LightProps as DirectionalLightProps} from './directional_light_properties.js';

type LightProps = FlatLightProps | AmbientLightProps | DirectionalLightProps;

class Lights<P: LightProps> extends Evented {
    scope: string;
    properties: PossiblyEvaluated<P>;
    _transitionable: Transitionable<P>;
    _transitioning: Transitioning<P>;
    _options: LightsSpecification;

    constructor(options: LightsSpecification, properties: Properties<P>, scope: string, configOptions?: ?ConfigOptions) {
        super();
        this.scope = scope;
        this._options = options;
        this.properties = new PossiblyEvaluated(properties);

        this._transitionable = new Transitionable(properties, scope, new Map(configOptions));
        this._transitionable.setTransitionOrValue(options.properties);
        this._transitioning = this._transitionable.untransitioned();
    }

    updateConfig(configOptions?: ?ConfigOptions) {
        this._transitionable.setTransitionOrValue(this._options.properties, new Map(configOptions));
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
        // $FlowFixMe
        this._options.properties = this._transitionable.serialize();
        return this._options;
    }

    set(options: LightsSpecification, configOptions?: ?ConfigOptions) {
        this._options = options;
        this._transitionable.setTransitionOrValue(options.properties, configOptions);
    }

    shadowsEnabled(): boolean {
        if (!this.properties) return false;
        // $FlowFixMe
        return this.properties.get('cast-shadows') === true;
    }
}

export default Lights;
