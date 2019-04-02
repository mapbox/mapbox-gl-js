// @flow

import { bindAll } from '../../util/util';

import type Map from '../map';
import type {MapMouseEvent, MapTouchEvent} from '../events';
import type Point from '@mapbox/point-geometry';

// maximum distance between two tap Points for them to qualify as a double-tap
const maxDist = 30;

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking or double tapping.
 */
class DoubleClickZoomHandler {
    _map: Map;
    _enabled: boolean;
    _active: boolean;
    _tapped: ?TimeoutID;
    _tappedPoint: ?Point;

    /**
     * @private
     */
    constructor(map: Map) {
        this._map = map;

        bindAll([
            '_onDblClick',
            '_onZoomEnd'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is active.
     */
    isActive() {
        return !!this._active;
    }

    /**
     * Enables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.enable();
     */
    enable() {
        if (this.isEnabled()) return;
        this._enabled = true;
    }

    /**
     * Disables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._enabled = false;
    }

    onTouchStart(e: MapTouchEvent) {
        if (!this.isEnabled()) return;
        if (e.points.length > 1) return;

        if (!this._tapped) {
            this._tappedPoint = e.points[0];
            this._tapped = setTimeout(() => { this._tapped = null; this._tappedPoint = null; }, 300);
        } else {
            const newTap = e.points[0];
            const firstTap = this._tappedPoint;

            if (firstTap && firstTap.dist(newTap) <= maxDist) {
                e.originalEvent.preventDefault(); // prevent duplicate zoom on dblclick

                const onTouchEnd = () => { // ignore the touchend event, as it has no point we can zoom to
                    if (this._tapped) { // make sure we are still within the timeout window
                        this._zoom(e); // pass the original touchstart event, with the tapped point
                    }
                    this._map.off('touchcancel', onTouchCancel);
                    this._resetTapped();
                };

                const onTouchCancel = () => {
                    this._map.off('touchend', onTouchEnd);
                    this._resetTapped();
                };

                this._map.once('touchend', onTouchEnd);
                this._map.once('touchcancel', onTouchCancel);

            } else { // touches are too far apart, don't zoom
                this._resetTapped();
            }
        }
    }

    _resetTapped() {
        clearTimeout(this._tapped);
        this._tapped = null;
        this._tappedPoint = null;
    }

    onDblClick(e: MapMouseEvent) {
        if (!this.isEnabled()) return;
        e.originalEvent.preventDefault();
        this._zoom(e);
    }

    _zoom(e: MapMouseEvent | MapTouchEvent) {
        this._active = true;
        this._map.on('zoomend', this._onZoomEnd);
        this._map.zoomTo(
            this._map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1),
            {around: e.lngLat},
            e
        );
    }

    _onZoomEnd() {
        this._active = false;
        this._map.off('zoomend', this._onZoomEnd);
    }
}

export default DoubleClickZoomHandler;
