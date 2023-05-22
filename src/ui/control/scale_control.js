// @flow

import * as DOM from '../../util/dom.js';
import {extend, bindAll} from '../../util/util.js';

import type Map, {ControlPosition} from '../map.js';

type Unit = 'imperial' | 'metric' | 'nautical';

type Options = {
    maxWidth?: number,
    unit?: Unit;
};

const defaultOptions: Options = {
    maxWidth: 100,
    unit: 'metric'
};

const unitAbbr = {
    kilometer: 'km',
    meter: 'm',
    mile: 'mi',
    foot: 'ft',
    'nautical-mile': 'nm',
};

/**
 * A `ScaleControl` control displays the ratio of a distance on the map to the corresponding distance on the ground.
 * Add this control to a map using {@link Map#addControl}.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {number} [options.maxWidth='100'] The maximum length of the scale control in pixels.
 * @param {string} [options.unit='metric'] Unit of the distance (`'imperial'`, `'metric'` or `'nautical'`).
 * @example
 * const scale = new mapboxgl.ScaleControl({
 *     maxWidth: 80,
 *     unit: 'imperial'
 * });
 * map.addControl(scale);
 *
 * scale.setUnit('metric');
 */
class ScaleControl {
    _map: Map;
    _container: HTMLElement;
    _language: ?string | ?string[];
    _isNumberFormatSupported: boolean;
    options: Options;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        // Some old browsers (e.g., Safari < 14.1) don't support the "unit" style in NumberFormat.
        // This is a workaround to display the scale without proper internationalization support.
        this._isNumberFormatSupported = isNumberFormatSupported();

        bindAll([
            '_update',
            '_setScale',
            'setUnit'
        ], this);
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    _update() {
        // A horizontal scale is imagined to be present at center of the map
        // container with maximum length (Default) as 100px.
        // Using spherical law of cosines approximation, the real distance is
        // found between the two coordinates.
        const maxWidth = this.options.maxWidth || 100;

        const map = this._map;
        const y = map._containerHeight / 2;
        const x = (map._containerWidth / 2) - maxWidth / 2;
        const left = map.unproject([x, y]);
        const right = map.unproject([x + maxWidth, y]);
        const maxMeters = left.distanceTo(right);
        // The real distance corresponding to 100px scale length is rounded off to
        // near pretty number and the scale length for the same is found out.
        // Default unit of the scale is based on User's locale.
        if (this.options.unit === 'imperial') {
            const maxFeet = 3.2808 * maxMeters;
            if (maxFeet > 5280) {
                const maxMiles = maxFeet / 5280;
                this._setScale(maxWidth, maxMiles, 'mile');
            } else {
                this._setScale(maxWidth, maxFeet, 'foot');
            }
        } else if (this.options.unit === 'nautical') {
            const maxNauticals = maxMeters / 1852;
            this._setScale(maxWidth, maxNauticals, 'nautical-mile');
        } else if (maxMeters >= 1000) {
            this._setScale(maxWidth, maxMeters / 1000, 'kilometer');
        } else {
            this._setScale(maxWidth, maxMeters, 'meter');
        }
    }

    _setScale(maxWidth: number, maxDistance: number, unit: string) {
        this._map._requestDomTask(() => {
            const distance = getRoundNum(maxDistance);
            const ratio = distance / maxDistance;

            if (this._isNumberFormatSupported && unit !== 'nautical-mile') {
                // $FlowFixMe[incompatible-call] — flow v0.190.1 doesn't support optional `locales` argument and `unit` style option
                this._container.innerHTML = new Intl.NumberFormat(this._language, {style: 'unit', unitDisplay: 'short', unit}).format(distance);
            } else {
                this._container.innerHTML = `${distance}&nbsp;${unitAbbr[unit]}`;
            }

            this._container.style.width = `${maxWidth * ratio}px`;
        });
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        this._language = map.getLanguage();
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-scale', map.getContainer());
        this._container.dir = 'auto';

        // $FlowFixMe[method-unbinding]
        this._map.on('move', this._update);
        this._update();

        return this._container;
    }

    onRemove() {
        this._container.remove();
        // $FlowFixMe[method-unbinding]
        this._map.off('move', this._update);
        this._map = (undefined: any);
    }

    _setLanguage(language: string) {
        this._language = language;
        this._update();
    }

    /**
     * Set the scale's unit of the distance.
     *
     * @param {'imperial' | 'metric' | 'nautical'} unit Unit of the distance (`'imperial'`, `'metric'` or `'nautical'`).
     */
    setUnit(unit: Unit) {
        this.options.unit = unit;
        this._update();
    }
}

export default ScaleControl;

function isNumberFormatSupported() {
    try {
        // $FlowIgnore
        new Intl.NumberFormat('en', {style: 'unit', unitDisplay: 'short', unit: 'meter'});
        return true;
    } catch (_) {
        return false;
    }
}

function getDecimalRoundNum(d: number) {
    const multiplier = Math.pow(10, Math.ceil(-Math.log(d) / Math.LN10));
    return Math.round(d * multiplier) / multiplier;
}

function getRoundNum(num: number) {
    const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
    let d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
        d >= 3 ? 3 :
        d >= 2 ? 2 :
        d >= 1 ? 1 : getDecimalRoundNum(d);

    return pow10 * d;
}
