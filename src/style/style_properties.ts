import styleSpec from '../style-spec/reference/latest';
import {Evented} from '../util/evented';
import {validateStyle, emitValidationErrors} from './validate_style';
import {PropertyValues, PossiblyEvaluated} from './properties';

import type {Validator} from './validate_style';
import type EvaluationParameters from './evaluation_parameters';
import type {StyleSetterOptions} from './style';
import type {
    Properties,
    TransitionParameters,
    ConfigOptions,
    PropertyValueSpecifications
} from './properties';

/**
 * Transition and evaluation state shared by the root-level style objects:
 * lights, fog, terrain, rain and snow.
 * @private
 */
export class StyleProperties<Props extends {[Key in keyof Props]: Props[Key]}> extends Evented {
    _transitionable: PropertyValues<Props>;
    properties: PossiblyEvaluated<Props>;
    scope: string;
    // Last values passed to `_setValues`, re-applied when the config changes
    _values: PropertyValueSpecifications<Props> | null | undefined;

    constructor(properties: Properties<Props>, scope?: string, configOptions?: ConfigOptions | null) {
        super();
        this.scope = scope;
        this._transitionable = new PropertyValues(properties, true, scope, configOptions);
        this.properties = new PossiblyEvaluated(properties);
    }

    _setValues(values: PropertyValueSpecifications<Props> | null | undefined, configOptions?: ConfigOptions | null) {
        this._values = values;
        this._transitionable.setTransitionOrValue(values, configOptions ? new Map(configOptions) : undefined);
    }

    // Takes a snapshot of `configOptions` rather than holding a live reference to it; the style calls
    // this with its current config on every config change
    updateConfig(configOptions?: ConfigOptions | null) {
        this._transitionable.setTransitionOrValue(this._values, new Map(configOptions));
    }

    // Like `updateConfig`, but snaps the displayed values to the new ones. Used at initial style load, where
    // the constructor-time config snapshot may be missing options from imports that hadn't loaded yet.
    resetConfig(configOptions?: ConfigOptions | null) {
        this.updateConfig(configOptions);
        this._transitionable.snap();
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitionable.updateTransitions(parameters);
    }

    hasTransition(): boolean {
        return this._transitionable.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitionable.possiblyEvaluate(parameters);
    }

    _validate(validate: Validator, value: unknown, options?: StyleSetterOptions): boolean {
        if (options && options.validate === false) {
            return false;
        }

        return emitValidationErrors(this, validate.call(validateStyle, {value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec}));
    }
}
