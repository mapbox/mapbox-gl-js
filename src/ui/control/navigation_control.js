// @flow

import * as DOM from '../../util/dom.js';
import {extend, bindAll} from '../../util/util.js';
import {MouseRotateHandler, MousePitchHandler} from '../handler/mouse.js';
import window from '../../util/window.js';

import type Map from '../map.js';
import type Point from '@mapbox/point-geometry';

type Options = {
    showCompass?: boolean,
    showZoom?: boolean,
    visualizePitch?: boolean
};

const defaultOptions: Options = {
    showCompass: true,
    showZoom: true,
    visualizePitch: false
};

/**
 * A `NavigationControl` control contains zoom buttons and a compass.
 * Add this control to a map using {@link Map#addControl}.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {boolean} [options.showCompass=true] If `true` the compass button is included.
 * @param {boolean} [options.showZoom=true] If `true` the zoom-in and zoom-out buttons are included.
 * @param {boolean} [options.visualizePitch=false] If `true` the pitch is visualized by rotating X-axis of compass.
 * @example
 * const nav = new mapboxgl.NavigationControl();
 * map.addControl(nav, 'top-left');
 * @example
 * const nav = new mapboxgl.NavigationControl({
 *     visualizePitch: true
 * });
 * map.addControl(nav, 'bottom-right');
 * @see [Example: Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
 * @see [Example: Add a third party vector tile source](https://www.mapbox.com/mapbox-gl-js/example/third-party/)
 */
class NavigationControl {
    _map: ?Map;
    options: Options;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement;
    _zoomOutButton: HTMLButtonElement;
    _compass: HTMLButtonElement;
    _compassIcon: HTMLElement;
    _handler: ?MouseRotateWrapper;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

        if (this.options.showZoom) {
            bindAll([
                '_setButtonTitle',
                '_updateZoomButtons'
            ], this);
            this._zoomInButton = this._createButton('mapboxgl-ctrl-zoom-in', (e) => { if (this._map) this._map.zoomIn({}, {originalEvent: e}); });
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomInButton).setAttribute('aria-hidden', 'true');
            this._zoomOutButton = this._createButton('mapboxgl-ctrl-zoom-out', (e) => { if (this._map) this._map.zoomOut({}, {originalEvent: e}); });
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomOutButton).setAttribute('aria-hidden', 'true');
        }
        if (this.options.showCompass) {
            bindAll([
                '_rotateCompassArrow'
            ], this);
            this._compass = this._createButton('mapboxgl-ctrl-compass', (e) => {
                const map = this._map;
                if (!map) return;
                if (this.options.visualizePitch) {
                    map.resetNorthPitch({}, {originalEvent: e});
                } else {
                    map.resetNorth({}, {originalEvent: e});
                }
            });
            this._compassIcon = DOM.create('span', 'mapboxgl-ctrl-icon', this._compass);
            this._compassIcon.setAttribute('aria-hidden', 'true');
        }
    }

    _updateZoomButtons() {
        const map = this._map;
        if (!map) return;

        const zoom = map.getZoom();
        const isMax = zoom === map.getMaxZoom();
        const isMin = zoom === map.getMinZoom();
        this._zoomInButton.disabled = isMax;
        this._zoomOutButton.disabled = isMin;
        this._zoomInButton.setAttribute('aria-disabled', isMax.toString());
        this._zoomOutButton.setAttribute('aria-disabled', isMin.toString());
    }

    _rotateCompassArrow() {
        const map = this._map;
        if (!map) return;

        const rotate = this.options.visualizePitch ?
            `scale(${1 / Math.pow(Math.cos(map.transform.pitch * (Math.PI / 180)), 0.5)}) rotateX(${map.transform.pitch}deg) rotateZ(${map.transform.angle * (180 / Math.PI)}deg)` :
            `rotate(${map.transform.angle * (180 / Math.PI)}deg)`;

        map._requestDomTask(() => {
            if (this._compassIcon) {
                this._compassIcon.style.transform = rotate;
            }
        });
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(this._zoomInButton, 'ZoomIn');
            this._setButtonTitle(this._zoomOutButton, 'ZoomOut');
            // $FlowFixMe[method-unbinding]
            map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(this._compass, 'ResetBearing');
            if (this.options.visualizePitch) {
                // $FlowFixMe[method-unbinding]
                map.on('pitch', this._rotateCompassArrow);
            }
            // $FlowFixMe[method-unbinding]
            map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            this._handler = new MouseRotateWrapper(map, this._compass, this.options.visualizePitch);
        }
        return this._container;
    }

    onRemove() {
        const map = this._map;
        if (!map) return;
        this._container.remove();
        if (this.options.showZoom) {
            // $FlowFixMe[method-unbinding]
            map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                // $FlowFixMe[method-unbinding]
                map.off('pitch', this._rotateCompassArrow);
            }
            // $FlowFixMe[method-unbinding]
            map.off('rotate', this._rotateCompassArrow);
            if (this._handler) this._handler.off();
            this._handler = undefined;
        }
        this._map = undefined;
    }

    _createButton(className: string, fn: () => mixed): HTMLButtonElement {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }

    _setButtonTitle(button: HTMLButtonElement, title: string) {
        if (!this._map) return;
        const str = this._map._getUIString(`NavigationControl.${title}`);
        button.setAttribute('aria-label', str);
        if (button.firstElementChild) button.firstElementChild.setAttribute('title', str);
    }
}

class MouseRotateWrapper {

    map: Map;
    _clickTolerance: number;
    element: HTMLElement;
    mouseRotate: MouseRotateHandler;
    mousePitch: MousePitchHandler;
    _startPos: ?Point;
    _lastPos: ?Point;

    constructor(map: Map, element: HTMLElement, pitch?: boolean = false) {
        this._clickTolerance = 10;
        this.element = element;
        this.mouseRotate = new MouseRotateHandler({clickTolerance: map.dragRotate._mouseRotate._clickTolerance});
        this.map = map;
        if (pitch) this.mousePitch = new MousePitchHandler({clickTolerance: map.dragRotate._mousePitch._clickTolerance});

        bindAll(['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'reset'], this);
        // $FlowFixMe[method-unbinding]
        element.addEventListener('mousedown', this.mousedown);
        // $FlowFixMe[method-unbinding]
        element.addEventListener('touchstart', this.touchstart, {passive: false});
        // $FlowFixMe[method-unbinding]
        element.addEventListener('touchmove', this.touchmove);
        // $FlowFixMe[method-unbinding]
        element.addEventListener('touchend', this.touchend);
        // $FlowFixMe[method-unbinding]
        element.addEventListener('touchcancel', this.reset);
    }

    down(e: MouseEvent, point: Point) {
        this.mouseRotate.mousedown(e, point);
        if (this.mousePitch) this.mousePitch.mousedown(e, point);
        DOM.disableDrag();
    }

    move(e: MouseEvent, point: Point) {
        const map = this.map;
        const r = this.mouseRotate.mousemoveWindow(e, point);
        const delta = r && r.bearingDelta;
        if (delta) map.setBearing(map.getBearing() + delta);
        if (this.mousePitch) {
            const p = this.mousePitch.mousemoveWindow(e, point);
            const delta = p && p.pitchDelta;
            if (delta) map.setPitch(map.getPitch() + delta);
        }
    }

    off() {
        const element = this.element;
        // $FlowFixMe[method-unbinding]
        element.removeEventListener('mousedown', this.mousedown);
        // $FlowFixMe[method-unbinding]
        element.removeEventListener('touchstart', this.touchstart, {passive: false});
        // $FlowFixMe[method-unbinding]
        element.removeEventListener('touchmove', this.touchmove);
        // $FlowFixMe[method-unbinding]
        element.removeEventListener('touchend', this.touchend);
        // $FlowFixMe[method-unbinding]
        element.removeEventListener('touchcancel', this.reset);
        this.offTemp();
    }

    offTemp() {
        DOM.enableDrag();
        // $FlowFixMe[method-unbinding]
        window.removeEventListener('mousemove', this.mousemove);
        // $FlowFixMe[method-unbinding]
        window.removeEventListener('mouseup', this.mouseup);
    }

    mousedown(e: MouseEvent) {
        this.down(extend({}, e, {ctrlKey: true, preventDefault: () => e.preventDefault()}), DOM.mousePos(this.element, e));
        // $FlowFixMe[method-unbinding]
        window.addEventListener('mousemove', this.mousemove);
        // $FlowFixMe[method-unbinding]
        window.addEventListener('mouseup', this.mouseup);
    }

    mousemove(e: MouseEvent) {
        this.move(e, DOM.mousePos(this.element, e));
    }

    mouseup(e: MouseEvent) {
        this.mouseRotate.mouseupWindow(e);
        if (this.mousePitch) this.mousePitch.mouseupWindow(e);
        this.offTemp();
    }

    touchstart(e: TouchEvent) {
        if (e.targetTouches.length !== 1) {
            this.reset();
        } else {
            this._startPos = this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
            this.down((({type: 'mousedown', button: 0, ctrlKey: true, preventDefault: () => e.preventDefault()}: any): MouseEvent), this._startPos);
        }
    }

    touchmove(e: TouchEvent) {
        if (e.targetTouches.length !== 1) {
            this.reset();
        } else {
            this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
            this.move((({preventDefault: () => e.preventDefault()}: any): MouseEvent), this._lastPos);
        }
    }

    touchend(e: TouchEvent) {
        if (e.targetTouches.length === 0 &&
            this._startPos &&
            this._lastPos &&
            this._startPos.dist(this._lastPos) < this._clickTolerance) {
            this.element.click();
        }
        this.reset();
    }

    reset() {
        this.mouseRotate.reset();
        if (this.mousePitch) this.mousePitch.reset();
        delete this._startPos;
        delete this._lastPos;
        this.offTemp();
    }
}

export default NavigationControl;
