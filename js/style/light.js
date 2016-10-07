'use strict';

var styleSpec = require('./style_spec');
var util = require('../util/util');
var Evented = require('../util/evented');
var validateStyle = require('./validate_style');
var StyleDeclaration = require('./style_declaration');
var StyleTransition = require('./style_transition');

/*
 * Represents the light used to light extruded features.
 */
module.exports = Light;

var TRANSITION_SUFFIX = '-transition';

function Light(lightOptions) {
    this.set(lightOptions);
}

Light.prototype = util.inherit(Evented, {
    properties: ['anchor', 'color', 'position', 'intensity'],

    _specifications: styleSpec.$root.light,

    set: function(lightOpts) {
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

        for (var p in this.properties) {
            var prop = this.properties[p];

            this._declarations[prop] = new StyleDeclaration(this._specifications[prop], lightOpts[prop]);
        }

        return this;
    },

    getLight: function() {
        return {
            anchor: this.getLightProperty('anchor'),
            color: this.getLightProperty('color'),
            position: this.getLightProperty('position'),
            intensity: this.getLightProperty('intensity')
        };
    },

    getLightProperty: function(property) {
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
    },

    getLightValue: function(property, globalProperties) {
        if (property === 'position') {
            var calculated = this._transitions[property].calculate(globalProperties),
                cartesian = util.sphericalToCartesian(calculated);
            return {
                x: cartesian[0],
                y: cartesian[1],
                z: cartesian[2]
            };
        }

        return this._transitions[property].calculate(globalProperties);
    },

    setLight: function(options) {
        if (this._validate(validateStyle.light, options)) return;

        for (var key in options) {
            var value = options[key];

            if (util.endsWith(key, TRANSITION_SUFFIX)) {
                this._transitionOptions[key] = value;
            } else if (value === null || value === undefined) {
                delete this._declarations[key];
            } else {
                this._declarations[key] = new StyleDeclaration(this._specifications[key], value);
            }
        }
    },

    recalculate: function(zoom, zoomHistory) {
        for (var property in this._declarations) {
            this.calculated[property] = this.getLightValue(property, {zoom: zoom, zoomHistory: zoomHistory});
        }
    },

    _applyLightDeclaration: function(property, declaration, options, globalOptions, animationLoop) {
        var oldTransition = options.transition ? this._transitions[property] : undefined;
        var spec = this._specifications[property];

        if (declaration === null || declaration === undefined) {
            declaration = new StyleDeclaration(spec, spec.default);
        }

        if (oldTransition && oldTransition.declaration.json === declaration.json) return;

        var transitionOptions = util.extend({
            duration: 300,
            delay: 0
        }, globalOptions, this.getLightProperty(property + TRANSITION_SUFFIX));
        var newTransition = this._transitions[property] =
            new StyleTransition(spec, declaration, oldTransition, transitionOptions);
        if (!newTransition.instant()) {
            newTransition.loopID = animationLoop.set(newTransition.endTime - Date.now());
        }

        if (oldTransition) {
            animationLoop.cancel(oldTransition.loopID);
        }
    },

    updateLightTransitions: function(options, globalOptions, animationLoop) {
        var property;
        for (property in this._declarations) {
            this._applyLightDeclaration(property, this._declarations[property], options, globalOptions, animationLoop);
        }
    },

    _validate: function(validate, value) {
        return validateStyle.emitErrors(this, validate.call(validateStyle, util.extend({
            value: value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec: styleSpec
        })));
    },
});
