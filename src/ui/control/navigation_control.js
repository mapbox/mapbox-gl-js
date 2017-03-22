'use strict';

const DOM = require('../../util/dom');
const window = require('../../util/window');
const util = require('../../util/util');

const className = 'mapboxgl-ctrl';

/**
 * A `NavigationControl` control contains zoom buttons and a compass.
 *
 * @implements {IControl}
 * @example
 * var nav = new mapboxgl.NavigationControl();
 * map.addControl(nav, 'top-left');
 * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
 * @see [Add a third party vector tile source](https://www.mapbox.com/mapbox-gl-js/example/third-party/)
 */
class NavigationControl {

    constructor() {
        util.bindAll([
            '_rotateCompassArrow'
        ], this);
    }

    _rotateCompassArrow() {
        const rotate = `rotate(${this._map.transform.angle * (180 / Math.PI)}deg)`;
        this._compassArrow.style.transform = rotate;
    }

    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', `${className} ${className}-group`, map.getContainer());
        this._container.addEventListener('contextmenu', this._onContextMenu.bind(this));

        this._zoomInButton = this._createButton(`${className}-icon ${className}-zoom-in`, 'Zoom In', map.zoomIn.bind(map));
        this._zoomOutButton = this._createButton(`${className}-icon ${className}-zoom-out`, 'Zoom Out', map.zoomOut.bind(map));
        this._compass = this._createButton(`${className}-icon ${className}-compass`, 'Reset North', map.resetNorth.bind(map));

        this._compassArrow = DOM.create('span', `${className}-compass-arrow`, this._compass);

        this._compass.addEventListener('mousedown', this._onCompassDown.bind(this));
        this._onCompassMove = this._onCompassMove.bind(this);
        this._onCompassUp = this._onCompassUp.bind(this);

        this._map.on('rotate', this._rotateCompassArrow);
        this._rotateCompassArrow();

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map.off('rotate', this._rotateCompassArrow);
        this._map = undefined;
    }

    _onContextMenu(e) {
        e.preventDefault();
    }

    _onCompassDown(e) {
        if (e.button !== 0) return;

        DOM.disableDrag();
        window.document.addEventListener('mousemove', this._onCompassMove);
        window.document.addEventListener('mouseup', this._onCompassUp);

        this._map.getCanvasContainer().dispatchEvent(copyMouseEvent(e));
        e.stopPropagation();
    }

    _onCompassMove(e) {
        if (e.button !== 0) return;

        this._map.getCanvasContainer().dispatchEvent(copyMouseEvent(e));
        e.stopPropagation();
    }

    _onCompassUp(e) {
        if (e.button !== 0) return;

        window.document.removeEventListener('mousemove', this._onCompassMove);
        window.document.removeEventListener('mouseup', this._onCompassUp);
        DOM.enableDrag();

        this._map.getCanvasContainer().dispatchEvent(copyMouseEvent(e));
        e.stopPropagation();
    }

    _createButton(className, ariaLabel, fn) {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.setAttribute('aria-label', ariaLabel);
        a.addEventListener('click', () => { fn(); });
        return a;
    }

}

module.exports = NavigationControl;

function copyMouseEvent(e) {
    return new window.MouseEvent(e.type, {
        button: 2,    // right click
        buttons: 2,   // right click
        bubbles: true,
        cancelable: true,
        detail: e.detail,
        view: e.view,
        screenX: e.screenX,
        screenY: e.screenY,
        clientX: e.clientX,
        clientY: e.clientY,
        movementX: e.movementX,
        movementY: e.movementY,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey
    });
}
