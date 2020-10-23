// @flow

import DOM from '../../util/dom';
import {extend, bindAll} from '../../util/util';
import {MouseRotateHandler, MousePitchHandler} from '../handler/mouse';
import window from '../../util/window';

import type Map from '../map';

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
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Boolean} [options.showCompass=true] If `true` the compass button is included.
 * @param {Boolean} [options.showZoom=true] If `true` the zoom-in and zoom-out buttons are included.
 * @param {Boolean} [options.visualizePitch=false] If `true` the pitch is visualized by rotating X-axis of compass.
 * @example
 * var nav = new mapboxgl.NavigationControl();
 * map.addControl(nav, 'top-left');
 * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
 * @see [Add a third party vector tile source](https://www.mapbox.com/mapbox-gl-js/example/third-party/)
 */
class NavigationControl {
    _map: Map;
    options: Options;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement;
    _zoomOutButton: HTMLButtonElement;
    _compass: HTMLButtonElement;
    _compassIcon: HTMLElement;
    _handler: MouseRotateWrapper;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        if (this.options.showZoom) {
            bindAll([
                '_setButtonTitle',
                '_updateZoomButtons'
            ], this);
            this._zoomInButton = this._createButton('mapboxgl-ctrl-zoom-in', (e) => this._map.zoomIn({}, {originalEvent: e}));
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomInButton).setAttribute('aria-hidden', true);
            this._zoomOutButton = this._createButton('mapboxgl-ctrl-zoom-out', (e) => this._map.zoomOut({}, {originalEvent: e}));
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomOutButton).setAttribute('aria-hidden', true);
        }
        if (this.options.showCompass) {
            bindAll([
                '_rotateCompassArrow'
            ], this);
            this._compass = this._createButton('mapboxgl-ctrl-compass', (e) => {
                if (this.options.visualizePitch) {
                    this._map.resetNorthPitch({}, {originalEvent: e});
                } else {
                    this._map.resetNorth({}, {originalEvent: e});
                }
            });
            this._compassIcon = DOM.create('span', 'mapboxgl-ctrl-icon', this._compass);
            this._compassIcon.setAttribute('aria-hidden', true);
        }
    }

    _updateZoomButtons() {
        const zoom = this._map.getZoom();
        const isMax = zoom === this._map.getMaxZoom();
        const isMin = zoom === this._map.getMinZoom();
        this._zoomInButton.disabled = isMax;
        this._zoomOutButton.disabled = isMin;
        this._zoomInButton.setAttribute('aria-disabled', isMax.toString());
        this._zoomOutButton.setAttribute('aria-disabled', isMin.toString());
    }

    _rotateCompassArrow() {
        const rotate = this.options.visualizePitch ?
            `scale(${1 / Math.pow(Math.cos(this._map.transform.pitch * (Math.PI / 180)), 0.5)}) rotateX(${this._map.transform.pitch}deg) rotateZ(${this._map.transform.angle * (180 / Math.PI)}deg)` :
            `rotate(${this._map.transform.angle * (180 / Math.PI)}deg)`;

        this._compassIcon.style.transform = rotate;
    }

    onAdd(map: Map) {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(this._zoomInButton, 'ZoomIn');
            this._setButtonTitle(this._zoomOutButton, 'ZoomOut');
            this._map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(this._compass, 'ResetBearing');
            if (this.options.visualizePitch) {
                this._map.on('pitch', this._rotateCompassArrow);
            }
            this._map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            this._handler = new MouseRotateWrapper(this._map, this._compass, this.options.visualizePitch);
        }
        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);
        if (this.options.showZoom) {
            this._map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                this._map.off('pitch', this._rotateCompassArrow);
            }
            this._map.off('rotate', this._rotateCompassArrow);
            this._handler.off();
            delete this._handler;
        }

        delete this._map;
    }

    _createButton(className: string, fn: () => mixed) {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }

    _setButtonTitle(button: HTMLButtonElement, title: string) {
        const str = this._map._getUIString(`NavigationControl.${title}`);
        button.title = str;
        button.setAttribute('aria-label', str);
    }
}

class MouseRotateWrapper {

    map: Map;
    _clickTolerance: number;
    element: HTMLElement;
    mouseRotate: MouseRotateHandler;
    mousePitch: MousePitchHandler;
    _startPos: Point;
    _lastPos: Point;

    constructor(map: Map, element: HTMLElement, pitch?: boolean = false) {
        this._clickTolerance = 10;
        this.element = element;
        this.mouseRotate = new MouseRotateHandler({clickTolerance: map.dragRotate._mouseRotate._clickTolerance});
        this.map = map;
        if (pitch) this.mousePitch = new MousePitchHandler({clickTolerance: map.dragRotate._mousePitch._clickTolerance});

        bindAll(['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'reset'], this);
        DOM.addEventListener(element, 'mousedown', this.mousedown);
        DOM.addEventListener(element, 'touchstart', this.touchstart, {passive: false});
        DOM.addEventListener(element, 'touchmove', this.touchmove);
        DOM.addEventListener(element, 'touchend', this.touchend);
        DOM.addEventListener(element, 'touchcancel', this.reset);
    }

    down(e: MouseEvent, point: Point) {
        this.mouseRotate.mousedown(e, point);
        if (this.mousePitch) this.mousePitch.mousedown(e, point);
        DOM.disableDrag();
    }

    move(e: MouseEvent, point: Point) {
        const map = this.map;
        const r = this.mouseRotate.mousemoveWindow(e, point);
        if (r && r.bearingDelta) map.setBearing(map.getBearing() + r.bearingDelta);
        if (this.mousePitch) {
            const p = this.mousePitch.mousemoveWindow(e, point);
            if (p && p.pitchDelta) map.setPitch(map.getPitch() + p.pitchDelta);
        }
    }

    off() {
        const element = this.element;
        DOM.removeEventListener(element, 'mousedown', this.mousedown);
        DOM.removeEventListener(element, 'touchstart', this.touchstart, {passive: false});
        DOM.removeEventListener(element, 'touchmove', this.touchmove);
        DOM.removeEventListener(element, 'touchend', this.touchend);
        DOM.removeEventListener(element, 'touchcancel', this.reset);
        this.offTemp();
    }

    offTemp() {
        DOM.enableDrag();
        DOM.removeEventListener(window, 'mousemove', this.mousemove);
        DOM.removeEventListener(window, 'mouseup', this.mouseup);
    }

    mousedown(e: MouseEvent) {
        this.down(extend({}, e, {ctrlKey: true, preventDefault: () => e.preventDefault()}), DOM.mousePos(this.element, e));
        DOM.addEventListener(window, 'mousemove', this.mousemove);
        DOM.addEventListener(window, 'mouseup', this.mouseup);
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
