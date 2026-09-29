import {Evented} from '../../src/util/evented';
import {Transitionable, PossiblyEvaluated} from '../../src/style/properties';

import type EvaluationParameters from '../../src/style/evaluation_parameters';
import type {LightsSpecification} from '../../src/style-spec/types';
import type {TransitionParameters, ConfigOptions, Properties, PropertyValueSpecifications, Transitioning} from '../../src/style/properties';
import type {LightProps as FlatLightProps} from './flat_light_properties';
import type {LightProps as AmbientLightProps} from './ambient_light_properties';
import type {LightProps as DirectionalLightProps} from './directional_light_properties';

type LightProps = FlatLightProps | AmbientLightProps | DirectionalLightProps;

class Lights<P extends LightProps> extends Evented {
    scope: string;
    properties: PossiblyEvaluated<P>;
    _transitionable: Transitionable<P>;
    _transitioning: Transitioning<P>;
    _options: LightsSpecification;

    constructor(options: LightsSpecification, properties: Properties<P>, scope: string, configOptions?: ConfigOptions | null) {
        super();
        this.scope = scope;
        this._options = options;
        this.properties = new PossiblyEvaluated(properties);

        // Take a defensive snapshot of `configOptions` rather than holding a
        // live reference to it. `updateConfig`/`resetConfig` below are called
        // with a fresh snapshot on every config change
        this._transitionable = new Transitionable(properties, scope, new Map(configOptions));
        this.resetConfig(configOptions);
    }

    updateConfig(configOptions?: ConfigOptions | null) {
        this._transitionable.setTransitionOrValue(this._options.properties as PropertyValueSpecifications<P>, new Map(configOptions));
    }

    // Like `updateConfig`, but also resets `_transitioning` to the freshly-updated value,
    // skipping any transition. Used by the constructor (there is no prior visible state
    // to transition from yet) and at initial style load, where the constructor-time config
    // snapshot may be missing options from sibling imports that hadn't loaded yet.
    resetConfig(configOptions?: ConfigOptions | null) {
        this.updateConfig(configOptions);
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
        this._options.properties = this._transitionable.serialize() as LightsSpecification['properties'];
        return this._options;
    }

    set(options: LightsSpecification, configOptions?: ConfigOptions | null) {
        this._options = options;
        this._transitionable.setTransitionOrValue(options.properties as PropertyValueSpecifications<P>, configOptions ? new Map(configOptions) : undefined);
    }

    shadowsEnabled(): boolean {
        if (!this.properties) return false;
        return this.properties.get('cast-shadows' as keyof P) === true;
    }
}

export default Lights;
