// @flow

import {extend} from '../../util/util';
import Handler from './handler.js';
import type Map from '../map';

const defaultOptions = {
  panStep: 100,
  bearingStep: 15,
  pitchStep: 10
};

/**
 * The `KeyboardHandler` allows the user to zoom, rotate, and pan the map using
 * the following keyboard shortcuts:
 *
 * - `=` / `+`: Increase the zoom level by 1.
 * - `Shift-=` / `Shift-+`: Increase the zoom level by 2.
 * - `-`: Decrease the zoom level by 1.
 * - `Shift--`: Decrease the zoom level by 2.
 * - Arrow keys: Pan by 100 pixels.
 * - `Shift+⇢`: Increase the rotation by 15 degrees.
 * - `Shift+⇠`: Decrease the rotation by 15 degrees.
 * - `Shift+⇡`: Increase the pitch by 10 degrees.
 * - `Shift+⇣`: Decrease the pitch by 10 degrees.
 */
class KeyboardHandler extends Handler {
    _map: Map;
    _panStep: number;
    _bearingStep: number;
    _pitchStep: number;

    /**
    * @private
    */
    constructor(map: Map, options: ?Object) {
      super(map, options);
      this._map = map;
      const stepOptions = extend(defaultOptions, options);
      this._panStep = stepOptions.panStep;
      this._bearingStep = stepOptions.bearingStep;
      this._pitchStep = stepOptions.pitchStep;
    }

    keydown(e: KeyboardEvent) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        let zoomDir = 0;
        let bearingDir = 0;
        let pitchDir = 0;
        let xDir = 0;
        let yDir = 0;

        switch (e.keyCode) {
        case 61:
        case 107:
        case 171:
        case 187:
            zoomDir = 1;
            break;

        case 189:
        case 109:
        case 173:
            zoomDir = -1;
            break;

        case 37:
            if (e.shiftKey) {
                bearingDir = -1;
            } else {
                xDir = -1;
            }
            break;

        case 39:
            if (e.shiftKey) {
                bearingDir = 1;
            } else {
                xDir = 1;
            }
            break;

        case 38:
            if (e.shiftKey) {
                pitchDir = 1;
            } else {
                yDir = -1;
            }
            break;

        case 40:
            if (e.shiftKey) {
                pitchDir = -1;
            } else {
                yDir = 1;
            }
            break;

        default:
            return;
        }

        const map = this._map;
        const zoom = map.getZoom();

        const easeOptions = {
            duration: 300,
            delayEndEvents: 500,
            easing: easeOut,

            zoom: zoomDir ? Math.round(zoom) + zoomDir * (e.shiftKey ? 2 : 1) : zoom,
            bearing: map.getBearing() + bearingDir * this._bearingStep,
            pitch: map.getPitch() + pitchDir * this._pitchStep,
            offset: [-xDir * this._panStep, -yDir * this._panStep],
            center: map.getCenter()
        };

        return { easeTo: easeOptions }
    }
}

function easeOut(t) {
    return t * (2 - t);
}

export default KeyboardHandler;
