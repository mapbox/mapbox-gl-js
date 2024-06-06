import {Evented} from '../../src/util/evented';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated} from '../../src/style/properties';

import type EvaluationParameters from '../../src/style/evaluation_parameters';
import type {LightsSpecification} from '../../src/style-spec/types';
import type {TransitionParameters, ConfigOptions} from '../../src/style/properties';
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

        this._transitionable = new Transitionable(properties, scope, new Map(configOptions));
        // @ts-expect-error - TS2345 - Argument of type '{ color?: PropertyValueSpecification<string>; "color-transition"?: TransitionSpecification; intensity?: PropertyValueSpecification<number>; "intensity-transition"?: TransitionSpecification; } | { ...; } | { ...; }' is not assignable to parameter of type 'PropertyValueSpecifications<P>'.
        this._transitionable.setTransitionOrValue(options.properties);
        this._transitioning = this._transitionable.untransitioned();
    }

    updateConfig(configOptions?: ConfigOptions | null) {
        // @ts-expect-error - TS2345 - Argument of type '{ color?: PropertyValueSpecification<string>; "color-transition"?: TransitionSpecification; intensity?: PropertyValueSpecification<number>; "intensity-transition"?: TransitionSpecification; } | { ...; } | { ...; }' is not assignable to parameter of type 'PropertyValueSpecifications<P>'.
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
        // @ts-expect-error
        this._options.properties = this._transitionable.serialize();
        return this._options;
    }

    set(options: LightsSpecification, configOptions?: ConfigOptions | null) {
        this._options = options;
        // @ts-expect-error - TS2345 - Argument of type '{ color?: PropertyValueSpecification<string>; "color-transition"?: TransitionSpecification; intensity?: PropertyValueSpecification<number>; "intensity-transition"?: TransitionSpecification; } | { ...; } | { ...; }' is not assignable to parameter of type 'PropertyValueSpecifications<P>'.
        this._transitionable.setTransitionOrValue(options.properties, configOptions);
    }

    shadowsEnabled(): boolean {
        if (!this.properties) return false;
        // @ts-expect-error - TS2345 - Argument of type 'string' is not assignable to parameter of type 'keyof P'.
        return this.properties.get('cast-shadows') === true;
    }
}

export default Lights;
