'use strict';

const styleSpec = require('./style_spec');
const util = require('../util/util');
const Evented = require('../util/evented');
const validateStyle = require('./validate_style');
const StyleDeclaration = require('./style_declaration');
const StyleTransition = require('./style_transition');

const TRANSITION_SUFFIX = '-transition';

/*
 * Represents the light used to light extruded features.
 */
class Light extends Evented {

    constructor(lightOptions) {
        super();
        this.properties = ['anchor', 'color', 'position', 'intensity'];
        this._specifications = styleSpec.light;
        this.set(lightOptions);
    }

    set(lightOpts) {
        if (this._validate(validateStyle.light, lightOpts)) return;
        this._declarations = {};
        this._transitions = {};
        this._transitionOptions = {};
        this.calculated = {};

        lightOpts = util.extend({
            anchor: this._specifications.anchor.default,
            color: this._specifications.color.default,
            position: this._specifications.position.default,
            intensity: this._specifications.intensity.default
        }, lightOpts);

        for (const prop of this.properties) {
            this._declarations[prop] = new StyleDeclaration(this._specifications[prop], lightOpts[prop]);
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

    getLightProperty(property) {
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

    getLightValue(property, globalProperties) {
        if (property === 'position') {
            const calculated = this._transitions[property].calculate(globalProperties),
                cartesian = util.sphericalToCartesian(calculated);
            return {
                x: cartesian[0],
                y: cartesian[1],
                z: cartesian[2]
            };
        }

        return this._transitions[property].calculate(globalProperties);
    }

    setLight(options) {
        if (this._validate(validateStyle.light, options)) return;

        for (const key in options) {
            const value = options[key];

            if (util.endsWith(key, TRANSITION_SUFFIX)) {
                this._transitionOptions[key] = value;
            } else if (value === null || value === undefined) {
                delete this._declarations[key];
            } else {
                this._declarations[key] = new StyleDeclaration(this._specifications[key], value);
            }
        }
    }

    recalculate(zoom, zoomHistory) {
        for (const property in this._declarations) {
            this.calculated[property] = this.getLightValue(property, {zoom: zoom, zoomHistory: zoomHistory});
        }
    }

    _applyLightDeclaration(property, declaration, options, globalOptions, animationLoop) {
        const oldTransition = options.transition ? this._transitions[property] : undefined;
        const spec = this._specifications[property];

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

    updateLightTransitions(options, globalOptions, animationLoop) {
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
