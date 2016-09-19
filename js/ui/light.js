'use strict';

var util = require('../util/util');
var interpolate = require('../util/interpolate');
var parseColor = require('../style/parse_color');

/**
 * Controls the lighting used to light extruded features.
 *
 * @typedef {Object} LightOptions
 * @property {string} anchor Whether the light direction should be oriented based on the map or viewport. Options are `'map'`, `'viewport'`.
 * @property {Color} color The color to tint the extrusion lighting.
 * @property {Array<number>} direction The direction of the light source, in [r radial coordinate, θ azimuthal angle, φ polar angle], where r indicates the distance from the center of an object to its light, θ indicates the position of the light relative to 0° (like a clock), and φ indicates the height of the light source (from 0°, directly above, to 180°, directly below).
 * @property {number} intensity The intensity with which to light extruded features.
 * @property {number} duration The lighting animation's duration, measured in milliseconds.
 * @property {Function} easing The lighting animation's easing function.
 * @property {boolean} animate If `false`, no lighting animation will occur.
 */

var Lighting = module.exports = function() {};

util.extend(Lighting.prototype, /** @lends Map.prototype */{
    activeLightTransitions: {},

    /**
     * Get the full lighting object.
     *
     * @returns {Object} light Light object as denoted in the style spec.
     */
    getLight: function() {
        return {
            anchor: this.getLightProperty('anchor'),
            color: this.getLightProperty('color'),
            direction: this.getLightProperty('direction'),
            intensity: this.getLightProperty('intensity')
        };
    },

    /**
     * Get a specific light property.
     *
     * @param {String} property Light property. One of `anchor`, `color`, `direction`, `intensity`.
     * @returns {Value} value Value for specified property. Type per property is denoted in the style spec.
     */
    getLightProperty: function(property) {
        if (!(property in this.painter.light)) throw new Error('Unrecognized light property: ' + property);

        if (property === 'direction') {
            var dir = this.painter.light.direction;
            return [dir.r, dir.a, dir.p];
        }

        if (property === 'color') {
            return this.painter.light.rawColor;
        }

        return this.painter.light[property];
    },

    /**
     * Changes any combination of light values, with an animated transition
     * between old and new values (with the exception of `anchor`, which does
     * not animate). The map will retain its current values for any
     * details not specified in `options`.
     *
     * @param {LightOptions} options Options describing the target light properties of the transition.
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires lightstart
     * @fires lightend
     * @returns {Map} `this`
     */
    setLight: function(options, eventData) {
        this.stop();

        options = util.extend({
            duration: 500,
            easing: util.ease
        }, options);

        if (options.animate === false) options.duration = 0;

        var startAnchor = this.getLightProperty('anchor'),
            startColor = this.painter.light.color,
            startDirection = this.getLightProperty('direction'),
            startIntensity = this.getLightProperty('intensity'),

            anchor = 'anchor' in options ? options.anchor : startAnchor,
            color = 'color' in options ? parseColor(options.color) : startColor,
            direction = 'direction' in options ? options.direction : startDirection,
            intensity = 'intensity' in options ? +options.intensity : startIntensity;

        // light.anchor does not transition.
        if (anchor !== startAnchor) this._setLightAnchor(anchor);

        this.activeLightTransitions.color = color !== startColor;
        this.activeLightTransitions.direction = direction.some(function(c, i) { return c !== startDirection[i]; });
        this.activeLightTransitions.intensity = intensity !== startIntensity;

        this.fire('lightstart', eventData);

        clearTimeout(this._onLightEnd);

        if (this.activeLightTransitions.direction) {
            // Normalize new azimuthal [0, 360) coordinates
            while (direction[1] >= 360) { direction[1] -= 360; }
            while (direction[1] < 0)    { direction[1] += 360; }
            // Clamp polar coordinates to [0, 180]
            if (direction[2] > 180)     { direction[2] = 180; }
            if (direction[2] < 0)       { direction[2] = 0; }

            // Wrap prior azimuthal coordinate for use in interpolation
            if (Math.abs(startDirection[1] - direction[1]) > 180) {
                if (direction[1] >= 180) {
                    startDirection[1] += 360;
                } else {
                    startDirection[1] -= 360;
                }
            }
        }

        this._ease(function(k) {
            if (this.activeLightTransitions.color) {
                this._setLightColor({
                    rawColor: options.color,
                    color: interpolate.color(startColor, color, k)
                });
            }
            if (this.activeLightTransitions.direction) {
                this._setLightDirection(interpolate.array(startDirection, direction, k));
            }
            if (this.activeLightTransitions.intensity) {
                this._setLightIntensity(interpolate(startIntensity, intensity, k));
            }
            this._update();
        }, function() {
            if (options.delayEndEvents) {
                this._onLightEnd = setTimeout(this._lightEnd.bind(this, eventData), options.delayEndEvents);
            } else {
                this._lightEnd(eventData);
            }
        }.bind(this), options);

        return this;
    },

    _lightEnd: function(eventData) {
        this.activeLightTransitions.color = false;
        this.activeLightTransitions.direction = false;
        this.activeLightTransitions.intensity = false;

        this.fire('lightend', eventData);
    },

    _setLightAnchor: function(anchor) {
        if (anchor === 'map' || anchor === 'viewport') {
            this.painter.setLight({
                anchor: anchor
            });
        } else throw new Error('light.anchor must be one of: `map`, `viewport`');

        return this;
    },

    _setLightColor: function(colorOpts) {
        // We persist both `rawColor` and `color`, so that the original (non-premultiplied) color
        // used in the stylesheet, map, or API may be retrieved later.

        if ('rawColor' in colorOpts && !('color' in colorOpts)) {
            colorOpts.color = parseColor(colorOpts.rawColor);
        } else if ('color' in colorOpts) {
            var _color = colorOpts.color;
            if (!Array.isArray(_color) || _color.length !== 4 ||
                _color.some(function(a) { return isNaN(+a) || a < 0 || a > 1; }))
                throw new Error('light.color must be a valid premultiplied color array.');
        }

        this.painter.setLight(colorOpts);

        return this;
    },

    _validateDirection: function(direction) {
        if (!Array.isArray(direction) || direction.length !== 3 ||
            !direction.every(function(i) { return !isNaN(+i); }))
            throw new Error('light.direction must be an array of three numbers');

        if (direction[1] < 0 || direction[1] >= 360) util.warnOnce('Azimuthal angle will be wrapped to [0, 360)');
        if (direction[2] < 0 || direction[2] >= 180) util.warnOnce('Polar angle will be clamped to [0, 180)');
    },

    _sphericalToCartesian: function(r, azimuthal, polar) {
        // We abstract "north"/"up" to be 0° when really this is 90° (π/2):
        // correct for that here
        azimuthal += 90;

        // Convert azimuthal and polar angles to radians
        azimuthal *= Math.PI / 180;
        polar *= Math.PI / 180;

        // spherical to cartesian (x, y, z)
        return [
            r * Math.cos(azimuthal) * Math.sin(polar),
            r * Math.sin(azimuthal) * Math.sin(polar),
            r * Math.cos(polar)
        ];
    },

    _setLightDirection: function(direction) {
        this._validateDirection(direction);

        var r = direction[0],
            a = direction[1],
            p = direction[2];
        var cartesianDirection = this._sphericalToCartesian(r, a, p);

        // We persist both spherical and cartesian coordinates: cartesian for
        // the painter, spherical for the light APIs (since calculating in
        // reverse is more difficult)
        this.painter.setLight({
            direction: {
                r: r,
                a: a,
                p: p,
                x: cartesianDirection[0],
                y: cartesianDirection[1],
                z: cartesianDirection[2]
            }
        });

        return this;
    },

    _setLightIntensity: function(intensity) {
        var value = +intensity;
        if (!isNaN(value) && value >= 0 && value <= 1) {
            this.painter.setLight({
                intensity: value
            });
        } else throw new Error('light.intensity must be a number between 0 and 1.');

        return this;
    },

    _setLightOptions: function(mapOpts, styleOpts) {
        // Used in batch setting initial light options.
        var lightOpts = util.extend(mapOpts, styleOpts || {});
        if (lightOpts.anchor) this._setLightAnchor(lightOpts.anchor);
        if (lightOpts.color) this._setLightColor({rawColor: lightOpts.color});
        if (lightOpts.direction) this._setLightDirection(lightOpts.direction);
        if (typeof lightOpts.intensity !== 'undefined') this._setLightIntensity(lightOpts.intensity);

        this._update();

        return this;
    }
});
