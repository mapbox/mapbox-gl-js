// @flow

const DOM = require('../../util/dom');
const LngLatBounds = require('../../geo/lng_lat_bounds');
const util = require('../../util/util');
const window = require('../../util/window');

import type Map from '../map';

/**
 * The `BoxZoomHandler` allows the user to zoom the map to fit within a bounding box.
 * The bounding box is defined by clicking and holding `shift` while dragging the cursor.
 *
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
class BoxZoomHandler {
    _map: Map;
    _el: HTMLElement;
    _container: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _startPos: any;
    _box: HTMLElement;

    constructor(map: Map) {
        this._map = map;
        this._el = map.getCanvasContainer();
        this._container = map.getContainer();

        util.bindAll([
            '_onMouseDown',
            '_onMouseMove',
            '_onMouseUp',
            '_onKeyDown'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "box zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "box zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "box zoom" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "box zoom" interaction is active.
     */
    isActive() {
        return !!this._active;
    }

    /**
     * Enables the "box zoom" interaction.
     *
     * @example
     *   map.boxZoom.enable();
     */
    enable() {
        if (this.isEnabled()) return;

        // the event listeners for the DragPanHandler have to fire _after_ the event listener for BoxZoomHandler in order,
        // for the DragPanHandler's check on map.boxZoom.isActive() to tell whether or not to ignore a keydown event
        // so this makes sure the firing order is preserved if the BoxZoomHandler is enabled after the DragPanHandler.
        if (this._map.dragPan) this._map.dragPan.disable();
        this._el.addEventListener('mousedown', this._onMouseDown, false);
        if (this._map.dragPan) this._map.dragPan.enable();

        this._enabled = true;
    }

    /**
     * Disables the "box zoom" interaction.
     *
     * @example
     *   map.boxZoom.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._el.removeEventListener('mousedown', this._onMouseDown);
        this._enabled = false;
    }

    _onMouseDown(e: MouseEvent) {
        if (!(e.shiftKey && e.button === 0)) return;

        window.document.addEventListener('mousemove', this._onMouseMove, false);
        window.document.addEventListener('keydown', this._onKeyDown, false);
        window.document.addEventListener('mouseup', this._onMouseUp, false);

        DOM.disableDrag();
        this._startPos = DOM.mousePos(this._el, e);
        this._active = true;
    }

    _onMouseMove(e: MouseEvent) {
        const p0 = this._startPos,
            p1 = DOM.mousePos(this._el, e);

        if (!this._box) {
            this._box = DOM.create('div', 'mapboxgl-boxzoom', this._container);
            this._container.classList.add('mapboxgl-crosshair');
            this._fireEvent('boxzoomstart', e);
        }

        const minX = Math.min(p0.x, p1.x),
            maxX = Math.max(p0.x, p1.x),
            minY = Math.min(p0.y, p1.y),
            maxY = Math.max(p0.y, p1.y);

        DOM.setTransform(this._box, `translate(${minX}px,${minY}px)`);

        this._box.style.width = `${maxX - minX}px`;
        this._box.style.height = `${maxY - minY}px`;
    }

    _onMouseUp(e: MouseEvent) {
        if (e.button !== 0) return;

        const p0 = this._startPos,
            p1 = DOM.mousePos(this._el, e),
            bounds = new LngLatBounds()
                .extend(this._map.unproject(p0))
                .extend(this._map.unproject(p1));

        this._finish();

        if (p0.x === p1.x && p0.y === p1.y) {
            this._fireEvent('boxzoomcancel', e);
        } else {
            this._map
                .fitBounds(bounds, {linear: true})
                .fire('boxzoomend', { originalEvent: e, boxZoomBounds: bounds });
        }
    }

    _onKeyDown(e: KeyboardEvent) {
        if (e.keyCode === 27) {
            this._finish();
            this._fireEvent('boxzoomcancel', e);
        }
    }

    _finish() {
        this._active = false;

        window.document.removeEventListener('mousemove', this._onMouseMove, false);
        window.document.removeEventListener('keydown', this._onKeyDown, false);
        window.document.removeEventListener('mouseup', this._onMouseUp, false);

        this._container.classList.remove('mapboxgl-crosshair');

        if (this._box) {
            DOM.remove(this._box);
            this._box = (null: any);
        }

        DOM.enableDrag();
    }

    _fireEvent(type: string, e: Event) {
        return this._map.fire(type, { originalEvent: e });
    }
}

module.exports = BoxZoomHandler;
