// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export function window(target) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (target.ownerDocument) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return target.ownerDocument.defaultView;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (target.defaultView) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return target.defaultView;
    } else {
        return target;
    }
}

const events: Record<string, any> = {};

events.click = function (target, options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    options = Object.assign({bubbles: true}, options);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const MouseEvent = window(target).MouseEvent;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mousedown', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mouseup', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('click', options));
};

events.drag = function (target, mousedownOptions, mouseUpOptions) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    mousedownOptions = Object.assign({bubbles: true}, mousedownOptions);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    mouseUpOptions = Object.assign({bubbles: true}, mouseUpOptions);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const MouseEvent = window(target).MouseEvent;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mousedown', mousedownOptions));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mouseup', mouseUpOptions));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('click', mouseUpOptions));
};

events.dblclick = function (target, options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    options = Object.assign({bubbles: true}, options);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const MouseEvent = window(target).MouseEvent;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mousedown', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mouseup', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('click', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mousedown', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('mouseup', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('click', options));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    target.dispatchEvent(new MouseEvent('dblclick', options));
};

['keydown', 'keyup', 'keypress'].forEach((event) => {
    events[event] = function (target, options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options = Object.assign({bubbles: true}, options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const KeyboardEvent = window(target).KeyboardEvent;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        target.dispatchEvent(new KeyboardEvent(event, options));
    };
});

['mouseup', 'mousedown', 'mouseover', 'mousemove', 'mouseout'].forEach((event) => {
    events[event] = function (target, options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options = Object.assign({bubbles: true}, options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const MouseEvent = window(target).MouseEvent;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        target.dispatchEvent(new MouseEvent(event, options));
    };
});

['wheel', 'mousewheel'].forEach((event) => {
    events[event] = function (target, options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options = Object.assign({bubbles: true}, options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const WheelEvent = window(target).WheelEvent;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        target.dispatchEvent(new WheelEvent(event, options));
    };
});

// magic deltaY value that indicates the event is from a mouse wheel
// (rather than a trackpad)
events.magicWheelZoomDelta = 4.000244140625;

export function constructTouch(target, options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const global = window(target);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return new global.Touch({
        identifier: Date.now(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        target,
        radiusX: 2.5,
        radiusY: 2.5,
        rotationAngle: 10,
        force: 0.5,
        ...options
    });
}

['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach((event) => {
    events[event] = function (target, options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const touch = constructTouch(target, {
            clientX: 0,
            clientY: 0,
        });
        const defaultTouches = event.endsWith('end') || event.endsWith('cancel') ? [] : [touch];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options = Object.assign({bubbles: true, touches: defaultTouches}, options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const TouchEvent = window(target).TouchEvent;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        target.dispatchEvent(new TouchEvent(event, options));
    };
});

['focus', 'blur'].forEach((event) => {
    events[event] = function (target, options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options = Object.assign({bubbles: true}, options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const FocusEvent = window(target).FocusEvent;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        target.dispatchEvent(new FocusEvent(event, options));
    };
});

export function simulateDoubleTap(map, delay = 100) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const canvas = map.getCanvas();
    return new Promise(resolve => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        events.touchstart(canvas, {touches: [constructTouch(canvas, {target: canvas, clientX: 0, clientY: 0})]});
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        events.touchend(canvas);
        setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            events.touchstart(canvas, {touches: [constructTouch(canvas, {target: canvas, clientX: 0, clientY: 0})]});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            events.touchend(canvas);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            map._renderTaskQueue.run();
            resolve();
        }, delay);
    });
}

export default events;
