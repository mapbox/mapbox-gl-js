
export function window(target) {
    if (target.ownerDocument) {
        return target.ownerDocument.defaultView;
    } else if (target.defaultView) {
        return target.defaultView;
    } else {
        return target;
    }
}

const events = {};

events.click = function (target, options) {
    options = Object.assign({bubbles: true}, options);
    const MouseEvent = window(target).MouseEvent;
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
};

events.drag = function (target, mousedownOptions, mouseUpOptions) {
    mousedownOptions = Object.assign({bubbles: true}, mousedownOptions);
    mouseUpOptions = Object.assign({bubbles: true}, mouseUpOptions);
    const MouseEvent = window(target).MouseEvent;
    target.dispatchEvent(new MouseEvent('mousedown', mousedownOptions));
    target.dispatchEvent(new MouseEvent('mouseup', mouseUpOptions));
    target.dispatchEvent(new MouseEvent('click', mouseUpOptions));
};

events.dblclick = function (target, options) {
    options = Object.assign({bubbles: true}, options);
    const MouseEvent = window(target).MouseEvent;
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
    target.dispatchEvent(new MouseEvent('dblclick', options));
};

['keydown', 'keyup', 'keypress'].forEach((event) => {
    events[event] = function (target, options) {
        options = Object.assign({bubbles: true}, options);
        const KeyboardEvent = window(target).KeyboardEvent;
        target.dispatchEvent(new KeyboardEvent(event, options));
    };
});

[ 'mouseup', 'mousedown', 'mouseover', 'mousemove', 'mouseout' ].forEach((event) => {
    events[event] = function (target, options) {
        options = Object.assign({bubbles: true}, options);
        const MouseEvent = window(target).MouseEvent;
        target.dispatchEvent(new MouseEvent(event, options));
    };
});

[ 'wheel', 'mousewheel' ].forEach((event) => {
    events[event] = function (target, options) {
        options = Object.assign({bubbles: true}, options);
        const WheelEvent = window(target).WheelEvent;
        target.dispatchEvent(new WheelEvent(event, options));
    };
});

// magic deltaY value that indicates the event is from a mouse wheel
// (rather than a trackpad)
events.magicWheelZoomDelta = 4.000244140625;

[ 'touchstart', 'touchend', 'touchmove', 'touchcancel' ].forEach((event) => {
    events[event] = function (target, options) {
        // Should be using Touch constructor here, but https://github.com/jsdom/jsdom/issues/2152.
        const defaultTouches = event.endsWith('end') || event.endsWith('cancel') ? [] : [{clientX: 0, clientY: 0}];
        options = Object.assign({bubbles: true, touches: defaultTouches}, options);
        const TouchEvent = window(target).TouchEvent;
        target.dispatchEvent(new TouchEvent(event, options));
    };
});

['focus', 'blur'].forEach((event) => {
    events[event] = function (target, options) {
        options = Object.assign({bubbles: true}, options);
        const FocusEvent = window(target).FocusEvent;
        target.dispatchEvent(new FocusEvent(event, options));
    };
});

export default events;
