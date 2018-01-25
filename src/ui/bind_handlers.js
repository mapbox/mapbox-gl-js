// @flow

const DOM = require('../util/dom');
const Point = require('@mapbox/point-geometry');

import type Map from './map';

const handlers = {
    scrollZoom: require('./handler/scroll_zoom'),
    boxZoom: require('./handler/box_zoom'),
    dragRotate: require('./handler/drag_rotate'),
    dragPan: require('./handler/drag_pan'),
    keyboard: require('./handler/keyboard'),
    doubleClickZoom: require('./handler/dblclick_zoom'),
    touchZoomRotate: require('./handler/touch_zoom_rotate')
};

module.exports = function bindHandlers(map: Map, options: {}) {
    const el = map.getCanvasContainer();
    let contextMenuEvent = null;
    let mouseDown = false;
    let startPos = null;
    let tapped = null;

    for (const name in handlers) {
        (map: any)[name] = new handlers[name](map, options);
        if (options.interactive && options[name]) {
            (map: any)[name].enable(options[name]);
        }
    }

    el.addEventListener('mouseout', onMouseOut, false);
    el.addEventListener('mousedown', onMouseDown, false);
    el.addEventListener('mouseup', onMouseUp, false);
    el.addEventListener('mousemove', onMouseMove, false);
    el.addEventListener('mouseover', onMouseOver, false);
    el.addEventListener('touchstart', onTouchStart, false);
    el.addEventListener('touchend', onTouchEnd, false);
    el.addEventListener('touchmove', onTouchMove, false);
    el.addEventListener('touchcancel', onTouchCancel, false);
    el.addEventListener('click', onClick, false);
    el.addEventListener('dblclick', onDblClick, false);
    el.addEventListener('contextmenu', onContextMenu, false);

    function onMouseOut(e: MouseEvent) {
        fireMouseEvent('mouseout', e);
    }

    function onMouseDown(e: MouseEvent) {
        if (!map.doubleClickZoom.isActive()) {
            map.stop();
        }

        startPos = DOM.mousePos(el, e);
        fireMouseEvent('mousedown', e);

        mouseDown = true;
    }

    function onMouseUp(e: MouseEvent) {
        const rotating = map.dragRotate && map.dragRotate.isActive();

        if (contextMenuEvent && !rotating) {
            // This will be the case for Mac
            fireMouseEvent('contextmenu', contextMenuEvent);
        }

        contextMenuEvent = null;
        mouseDown = false;
        fireMouseEvent('mouseup', e);
    }

    function onMouseMove(e: MouseEvent) {
        if (map.dragPan && map.dragPan.isActive()) return;
        if (map.dragRotate && map.dragRotate.isActive()) return;

        let target: any = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        fireMouseEvent('mousemove', e);
    }

    function onMouseOver(e: MouseEvent) {

        let target: any = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        fireMouseEvent('mouseover', e);
    }

    function onTouchStart(e: TouchEvent) {
        map.stop();
        fireTouchEvent('touchstart', e);

        if (!e.touches || e.touches.length > 1) return;

        if (!tapped) {
            tapped = setTimeout(onTouchTimeout, 300);

        } else {
            clearTimeout(tapped);
            tapped = null;
            fireMouseEvent('dblclick', e);
        }
    }

    function onTouchMove(e: TouchEvent) {
        fireTouchEvent('touchmove', e);
    }

    function onTouchEnd(e: TouchEvent) {
        fireTouchEvent('touchend', e);
    }

    function onTouchCancel(e: TouchEvent) {
        fireTouchEvent('touchcancel', e);
    }

    function onTouchTimeout() {
        tapped = null;
    }

    function onClick(e: MouseEvent) {
        const pos = DOM.mousePos(el, e);

        if (pos.equals((startPos: any))) {
            fireMouseEvent('click', e);
        }
    }

    function onDblClick(e: MouseEvent) {
        fireMouseEvent('dblclick', e);
        e.preventDefault();
    }

    function onContextMenu(e: MouseEvent) {
        const rotating = map.dragRotate && map.dragRotate.isActive();
        if (!mouseDown && !rotating) {
            // Windows: contextmenu fired on mouseup, so fire event now
            fireMouseEvent('contextmenu', e);
        } else if (mouseDown) {
            // Mac: contextmenu fired on mousedown; we save it until mouseup for consistency's sake
            contextMenuEvent = e;
        }

        e.preventDefault();
    }

    function fireMouseEvent(type, e) {
        const pos = DOM.mousePos(el, e);

        return map.fire(type, {
            lngLat: map.unproject(pos),
            point: pos,
            originalEvent: e
        });
    }

    function fireTouchEvent(type, e) {
        const touches = DOM.touchPos(el, e);
        const singular = touches.reduce((prev, curr, i, arr) => {
            return prev.add(curr.div(arr.length));
        }, new Point(0, 0));

        return map.fire(type, {
            lngLat: map.unproject(singular),
            point: singular,
            lngLats: touches.map((t) => { return map.unproject(t); }, this),
            points: touches,
            originalEvent: e
        });
    }
};
