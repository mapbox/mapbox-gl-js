// @flow

const {MapMouseEvent, MapTouchEvent} = require('../ui/events');

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

    function onMouseDown(e: MouseEvent) {
        mouseDown = true;

        const mapEvent = new MapMouseEvent('mousedown', map, e);
        map.fire(mapEvent);

        if (mapEvent.defaultPrevented) {
            return;
        }

        if (!map.doubleClickZoom.isActive()) {
            map.stop();
        }

        map.boxZoom.onMouseDown(e);
        map.dragRotate.onDown(e);
        map.dragPan.onDown(e);
    }

    function onMouseUp(e: MouseEvent) {
        const rotating = map.dragRotate.isActive();

        if (contextMenuEvent && !rotating) {
            // This will be the case for Mac
            map.fire(new MapMouseEvent('contextmenu', map, contextMenuEvent));
        }

        contextMenuEvent = null;
        mouseDown = false;

        map.fire(new MapMouseEvent('mouseup', map, e));
    }

    function onMouseMove(e: MouseEvent) {
        if (map.dragPan.isActive()) return;
        if (map.dragRotate.isActive()) return;

        let target: any = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        map.fire(new MapMouseEvent('mousemove', map, e));
    }

    function onMouseOver(e: MouseEvent) {
        let target: any = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        map.fire(new MapMouseEvent('mouseover', map, e));
    }

    function onMouseOut(e: MouseEvent) {
        map.fire(new MapMouseEvent('mouseout', map, e));
    }

    function onTouchStart(e: TouchEvent) {
        const mapEvent = new MapTouchEvent('touchstart', map, e);
        map.fire(mapEvent);

        if (mapEvent.defaultPrevented) {
            return;
        }

        map.stop();

        map.dragPan.onDown(e);
        map.touchZoomRotate.onStart(e);
        map.doubleClickZoom.onTouchStart(mapEvent);
    }

    function onTouchMove(e: TouchEvent) {
        map.fire(new MapTouchEvent('touchmove', map, e));
    }

    function onTouchEnd(e: TouchEvent) {
        map.fire(new MapTouchEvent('touchend', map, e));
    }

    function onTouchCancel(e: TouchEvent) {
        map.fire(new MapTouchEvent('touchcancel', map, e));
    }

    function onClick(e: MouseEvent) {
        map.fire(new MapMouseEvent('click', map, e));
    }

    function onDblClick(e: MouseEvent) {
        const mapEvent = new MapMouseEvent('dblclick', map, e);
        map.fire(mapEvent);

        if (mapEvent.defaultPrevented) {
            return;
        }

        map.doubleClickZoom.onDblClick(mapEvent);
    }

    function onContextMenu(e: MouseEvent) {
        const rotating = map.dragRotate.isActive();
        if (!mouseDown && !rotating) {
            // Windows: contextmenu fired on mouseup, so fire event now
            map.fire(new MapMouseEvent('contextmenu', map, e));
        } else if (mouseDown) {
            // Mac: contextmenu fired on mousedown; we save it until mouseup for consistency's sake
            contextMenuEvent = e;
        }

        e.preventDefault();
    }
};
