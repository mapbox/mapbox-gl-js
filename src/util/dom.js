// @flow strict

import Point from '@mapbox/point-geometry';

import window from './window.js';
import assert from 'assert';

// refine the return type based on tagName, e.g. 'button' -> HTMLButtonElement
// $FlowFixMe[method-unbinding]
export function create<T: string>(tagName: T, className: ?string, container?: HTMLElement): $Call<typeof document.createElement, T> {
    const el = window.document.createElement(tagName);
    if (className !== undefined) el.className = className;
    if (container) container.appendChild(el);
    return el;
}

export function createSVG(tagName: string, attributes: {[string]: string | number}, container?: Element): Element {
    const el = window.document.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const name of Object.keys(attributes)) {
        el.setAttributeNS(null, name, attributes[name]);
    }
    if (container) container.appendChild(el);
    return el;
}

const docStyle = window.document && window.document.documentElement.style;
const selectProp = docStyle && docStyle.userSelect !== undefined ? 'userSelect' : 'WebkitUserSelect';
let userSelect;

export function disableDrag() {
    if (docStyle && selectProp) {
        userSelect = docStyle[selectProp];
        docStyle[selectProp] = 'none';
    }
}

export function enableDrag() {
    if (docStyle && selectProp) {
        docStyle[selectProp] = userSelect;
    }
}

// Suppress the next click, but only if it's immediate.
function suppressClickListener(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', suppressClickListener, true);
}

export function suppressClick() {
    window.addEventListener('click', suppressClickListener, true);
    window.setTimeout(() => {
        window.removeEventListener('click', suppressClickListener, true);
    }, 0);
}

export function mousePos(el: HTMLElement, e: MouseEvent | WheelEvent): Point {
    const rect = el.getBoundingClientRect();
    return getScaledPoint(el, rect, e);
}

export function touchPos(el: HTMLElement, touches: TouchList): Array<Point> {
    const rect = el.getBoundingClientRect(),
        points = [];

    for (let i = 0; i < touches.length; i++) {
        points.push(getScaledPoint(el, rect, touches[i]));
    }
    return points;
}

export function mouseButton(e: MouseEvent): number {
    assert(e.type === 'mousedown' || e.type === 'mouseup');
    if (typeof window.InstallTrigger !== 'undefined' && e.button === 2 && e.ctrlKey &&
        window.navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        // Fix for https://github.com/mapbox/mapbox-gl-js/issues/3131:
        // Firefox (detected by InstallTrigger) on Mac determines e.button = 2 when
        // using Control + left click
        return 0;
    }
    return e.button;
}

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
