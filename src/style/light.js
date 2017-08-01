// @flow

const styleSpec = require('../style-spec/reference/latest');
const util = require('../util/util');
const Evented = require('../util/evented');
const validateStyle = require('./validate_style');
const StyleDeclaration = require('./style_declaration');
const StyleTransition = require('./style_transition');

import type AnimationLoop from './animation_loop';

const TRANSITION_SUFFIX = '-transition';
const properties = ['anchor', 'color', 'position', 'intensity'];
const specifications = styleSpec.light;

/*
 * Represents the light used to light extruded features.
 */
class Light extends Evented {
    _declarations: {[string]: StyleDeclaration};
    _transitions: {[string]: StyleTransition};
    _transitionOptions: {[string]: TransitionSpecification};
    calculated: {[string]: any};

    constructor(lightOptions?: LightSpecification) {
        super();
        this.set(lightOptions);
    }

    set(lightOpts) {
        if (this._validate(validateStyle.light, lightOpts)) return;
        this._declarations = {};
        this._transitions = {};
        this._transitionOptions = {};
        this.calculated = {};

        lightOpts = util.extend({
            anchor: specifications.anchor.default,
            color: specifications.color.default,
            position: specifications.position.default,
            intensity: specifications.intensity.default
        }, lightOpts);

        for (const prop of properties) {
            this._declarations[prop] = new StyleDeclaration(specifications[prop], lightOpts[prop]);
        }

        return this;
    }

    getLight() {
        return {
            anchor: this.getLightProperty('anchor'),
            color: this.getLightProperty('color'),
            position: this.getLightProperty('position'),
            intensity: this.getLightProperty('intensity')
        };
    }

    getLightProperty(property: string) {
        if (util.endsWith(property, TRANSITION_SUFFIX)) {
            return (
                this._transitionOptions[property]
            );
        } else {
            return (
                this._declarations[property] &&
                this._declarations[property].value
            );
        }
    }

    getLightValue(property: string, globalProperties: {zoom: number}) {
        if (property === 'position') {
            const calculated: any = this._transitions[property].calculate(globalProperties),
                cartesian = util.sphericalToCartesian(calculated);
            return {
                x: cartesian[0],
                y: cartesian[1],
                z: cartesian[2]
            };
        }

        return this._transitions[property].calculate(globalProperties);
    }

    setLight(options?: LightSpecification) {
        if (this._validate(validateStyle.light, options)) return;

        for (const key in options) {
            const value = options[key];

            if (util.endsWith(key, TRANSITION_SUFFIX)) {
                this._transitionOptions[key] = value;
            } else if (value === null || value === undefined) {
                delete this._declarations[key];
            } else {
                this._declarations[key] = new StyleDeclaration(specifications[key], value);
            }
        }
    }

    recalculate(zoom: number) {
        for (const property in this._declarations) {
            this.calculated[property] = this.getLightValue(property, {zoom: zoom});
        }
    }

    _applyLightDeclaration(property: string, declaration: StyleDeclaration, options: {}, globalOptions: {}, animationLoop: AnimationLoop) {
        const oldTransition = options.transition ? this._transitions[property] : undefined;
        const spec = specifications[property];

        if (declaration === null || declaration === undefined) {
            declaration = new StyleDeclaration(spec, spec.default);
        }

        if (oldTransition && oldTransition.declaration.json === declaration.json) return;

        const transitionOptions = util.extend({
            duration: 300,
            delay: 0
        }, globalOptions, this.getLightProperty(property + TRANSITION_SUFFIX));
        const newTransition = this._transitions[property] =
            new StyleTransition(spec, declaration, oldTransition, transitionOptions);
        if (!newTransition.instant()) {
            newTransition.loopID = animationLoop.set(newTransition.endTime - Date.now());
        }

        if (oldTransition) {
            animationLoop.cancel(oldTransition.loopID);
        }
    }

    updateLightTransitions(options: {}, globalOptions: {}, animationLoop: AnimationLoop) {
        let property;
        for (property in this._declarations) {
            this._applyLightDeclaration(property, this._declarations[property], options, globalOptions, animationLoop);
        }
    }

    _validate(validate, value) {
        return validateStyle.emitErrors(this, validate.call(validateStyle, util.extend({
            value: value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec: styleSpec
        })));
    }
}

module.exports = Light;
