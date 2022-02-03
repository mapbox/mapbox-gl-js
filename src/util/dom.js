// @flow strict

import Point from '@mapbox/point-geometry';

import window from './window.js';
import assert from 'assert';

const DOM = {};
export default DOM;

DOM.create = function (tagName: string, className: ?string, container?: HTMLElement) {
    const el = window.document.createElement(tagName);
    if (className !== undefined) el.className = className;
    if (container) container.appendChild(el);
    return el;
};

DOM.createSVG = function (tagName: string, attributes: {[string]: string | number}, container?: HTMLElement) {
    const el = window.document.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const name of Object.keys(attributes)) {
        el.setAttributeNS(null, name, attributes[name]);
    }
    if (container) container.appendChild(el);
    return el;
};

const docStyle = window.document && window.document.documentElement.style;
const selectProp = docStyle && docStyle.userSelect !== undefined ? 'userSelect' : 'WebkitUserSelect';
let userSelect;

DOM.disableDrag = function () {
    if (docStyle && selectProp) {
        userSelect = docStyle[selectProp];
        docStyle[selectProp] = 'none';
    }
};

DOM.enableDrag = function () {
    if (docStyle && selectProp) {
        docStyle[selectProp] = userSelect;
    }
};

// Suppress the next click, but only if it's immediate.
const suppressClick: MouseEventListener = function (e) {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', suppressClick, true);
};

DOM.suppressClick = function() {
    window.addEventListener('click', suppressClick, true);
    window.setTimeout(() => {
        window.removeEventListener('click', suppressClick, true);
    }, 0);
};

DOM.mousePos = function (el: HTMLElement, e: MouseEvent | WheelEvent) {
    const rect = el.getBoundingClientRect();
    return getScaledPoint(el, rect, e);
};

DOM.touchPos = function (el: HTMLElement, touches: TouchList) {
    const rect = el.getBoundingClientRect(),
        points = [];

    for (let i = 0; i < touches.length; i++) {
        points.push(getScaledPoint(el, rect, touches[i]));
    }
    return points;
};

DOM.mouseButton = function (e: MouseEvent) {
    assert(e.type === 'mousedown' || e.type === 'mouseup');
    if (typeof window.InstallTrigger !== 'undefined' && e.button === 2 && e.ctrlKey &&
        window.navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        // Fix for https://github.com/mapbox/mapbox-gl-js/issues/3131:
        // Firefox (detected by InstallTrigger) on Mac determines e.button = 2 when
        // using Control + left click
        return 0;
    }
    return e.button;
};

function getScaledPoint(el: HTMLElement, rect: ClientRect, e: MouseEvent | WheelEvent | Touch) {
    // Until we get support for pointer events (https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent)
    // we use this dirty trick which would not work for the case of rotated transforms, but works well for
    // the case of simple scaling.
    // Note: `el.offsetWidth === rect.width` eliminates the `0/0` case.
    const scaling = el.offsetWidth === rect.width ? 1 : el.offsetWidth / rect.width;
    return new Point(
        (e.clientX - rect.left) * scaling,
        (e.clientY - rect.top) * scaling
    );
}
