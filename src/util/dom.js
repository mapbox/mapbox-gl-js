// @flow

const Point = require('@mapbox/point-geometry');
const window = require('./window');

exports.create = function (tagName: *, className?: string, container?: HTMLElement) {
    const el = window.document.createElement(tagName);
    if (className) el.className = className;
    if (container) container.appendChild(el);
    return el;
};

exports.createNS = function (namespaceURI: string, tagName: string) {
    const el = window.document.createElementNS(namespaceURI, tagName);
    return el;
};

const docStyle = (window.document.documentElement: any).style;

function testProp(props) {
    for (let i = 0; i < props.length; i++) {
        if (props[i] in docStyle) {
            return props[i];
        }
    }
    return props[0];
}

const selectProp = testProp(['userSelect', 'MozUserSelect', 'WebkitUserSelect', 'msUserSelect']);
let userSelect;
exports.disableDrag = function () {
    if (selectProp) {
        userSelect = docStyle[selectProp];
        docStyle[selectProp] = 'none';
    }
};
exports.enableDrag = function () {
    if (selectProp) {
        docStyle[selectProp] = userSelect;
    }
};

const transformProp = testProp(['transform', 'WebkitTransform']);
exports.setTransform = function(el: HTMLElement, value: string) {
    (el.style: any)[transformProp] = value;
};

// Feature detection for {passive: false} support in add/removeEventListener.
let passiveSupported = false;

try {
    const options = (Object.defineProperty: any)({}, "passive", {
        get: function() {
            passiveSupported = true;
        }
    });
    (window.addEventListener: any)("test", options, options);
    (window.removeEventListener: any)("test", options, options);
} catch (err) {
    passiveSupported = false;
}

exports.addEventListener = function(target: *, type: *, callback: *, options: {passive?: boolean, capture?: boolean} = {}) {
    if ('passive' in options && passiveSupported) {
        target.addEventListener(type, callback, (options: any));
    } else {
        target.addEventListener(type, callback, options.capture);
    }
};

exports.removeEventListener = function(target: *, type: *, callback: *, options: {passive?: boolean, capture?: boolean} = {}) {
    if ('passive' in options && passiveSupported) {
        target.removeEventListener(type, callback, (options: any));
    } else {
        target.removeEventListener(type, callback, options.capture);
    }
};

// Suppress the next click, but only if it's immediate.
const suppressClick: MouseEventListener = function (e) {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', suppressClick, true);
};

exports.suppressClick = function() {
    window.addEventListener('click', suppressClick, true);
    window.setTimeout(() => {
        window.removeEventListener('click', suppressClick, true);
    }, 0);
};

exports.mousePos = function (el: HTMLElement, e: any) {
    const rect = el.getBoundingClientRect();
    e = e.touches ? e.touches[0] : e;
    return new Point(
        e.clientX - rect.left - el.clientLeft,
        e.clientY - rect.top - el.clientTop
    );
};

exports.touchPos = function (el: HTMLElement, e: any) {
    const rect = el.getBoundingClientRect(),
        points = [];
    const touches = (e.type === 'touchend') ? e.changedTouches : e.touches;
    for (let i = 0; i < touches.length; i++) {
        points.push(new Point(
            touches[i].clientX - rect.left - el.clientLeft,
            touches[i].clientY - rect.top - el.clientTop
        ));
    }
    return points;
};

exports.remove = function(node: HTMLElement) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
};
