// @flow

import { bindAll } from '../../util/util';

import type Map from '../map';
import type {MapMouseEvent, MapTouchEvent} from '../events';

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking or double tapping.
 */
class DoubleClickZoomHandler {
    _map: Map;
    _enabled: boolean;
    _active: boolean;
    _tapped: ?TimeoutID;
    _tappedPoint: ?{x: number, y: number};

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

        const maxDelta = 0;

        if (!this._tapped) {
            this._tappedPoint = e.points[0];
            this._tapped = setTimeout(() => { this._tapped = null; this._tappedPoint = null; }, 300);
        } else {
            const newTap = e.points[0];
            const firstTap = this._tappedPoint;

            if (firstTap && Math.abs(firstTap.x - newTap.x) <= maxDelta && Math.abs(firstTap.y - newTap.y) <= maxDelta) {
                const onTouchEnd = () => {
                    if (this._tapped) { // make sure we are still within the timeout window
                        this._zoom(e); // pass this touchstart event, as touchend events have no points
                    }
                    this._map.off('touchend', onTouchEnd);
                    this._resetTapped();
                };

                const onTouchCancel = () => {
                    this._map.off('touchend', onTouchEnd);
                    this._map.off('touchcancel', onTouchCancel);
                    this._resetTapped();
                };

                this._map.on('touchend', onTouchEnd);
                this._map.on('touchcancel', onTouchCancel);

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
