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
    _language: ?string;
    options: Options;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        bindAll([
            '_update',
            'setUnit'
        ], this);
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    _update() {
        updateScale(this._map, this._container, this._language, this.options);
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        this._language = map.getLanguage();
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-scale', map.getContainer());
        this._container.dir = 'auto';

        this._map.on('move', this._update);
        this._update();

        return this._container;
    }

    onRemove() {
        this._container.remove();
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

function updateScale(map, container, language, options) {
    // A horizontal scale is imagined to be present at center of the map
    // container with maximum length (Default) as 100px.
    // Using spherical law of cosines approximation, the real distance is
    // found between the two coordinates.
    const maxWidth = (options && options.maxWidth) || 100;

    const y = map._containerHeight / 2;
    const x = (map._containerWidth / 2) - maxWidth / 2;
    const left = map.unproject([x, y]);
    const right = map.unproject([x + maxWidth, y]);
    const maxMeters = left.distanceTo(right);
    // The real distance corresponding to 100px scale length is rounded off to
    // near pretty number and the scale length for the same is found out.
    // Default unit of the scale is based on User's locale.
    if (options && options.unit === 'imperial') {
        const maxFeet = 3.2808 * maxMeters;
        if (maxFeet > 5280) {
            const maxMiles = maxFeet / 5280;
            setScale(container, maxWidth, maxMiles, language, 'mile', map);
        } else {
            setScale(container, maxWidth, maxFeet, language, 'foot', map);
        }
    } else if (options && options.unit === 'nautical') {
        const maxNauticals = maxMeters / 1852;
        setScale(container, maxWidth, maxNauticals, language, 'nautical-mile', map);
    } else if (maxMeters >= 1000) {
        setScale(container, maxWidth, maxMeters / 1000, language, 'kilometer', map);
    } else {
        setScale(container, maxWidth, maxMeters, language, 'meter', map);
    }
}

function setScale(container, maxWidth, maxDistance, language, unit, map) {
    const distance = getRoundNum(maxDistance);
    const ratio = distance / maxDistance;

    map._requestDomTask(() => {
        container.style.width = `${maxWidth * ratio}px`;

        // Intl.NumberFormat doesn't support nautical-mile as a unit,
        // so we are hardcoding `nm` as a unit symbol for all locales
        if (unit === 'nautical-mile') {
            container.innerHTML = `${distance}&nbsp;nm`;
            return;
        }

        // $FlowFixMe — flow v0.142.0 doesn't support optional `locales` argument and `unit` style option
        container.innerHTML = new Intl.NumberFormat(language, {style: 'unit', unitDisplay: 'narrow', unit}).format(distance);
    });
}

function getDecimalRoundNum(d) {
    const multiplier = Math.pow(10, Math.ceil(-Math.log(d) / Math.LN10));
    return Math.round(d * multiplier) / multiplier;
}

function getRoundNum(num) {
    const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
    let d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
        d >= 3 ? 3 :
        d >= 2 ? 2 :
        d >= 1 ? 1 : getDecimalRoundNum(d);

    return pow10 * d;
}
