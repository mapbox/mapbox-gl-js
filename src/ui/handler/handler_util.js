// @flow

import assert from 'assert';

export function indexTouches(touches, points) {
    assert(touches.length === points.length);
    const obj = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}

export function getTouchesById(e, points, identifiers) {
    const touches = indexTouches(e.targetTouches, points);
    return identifiers.map(id => touches[id]);
}

export function log(message) {
    const log = document.getElementById('log');
    log.innerHTML = log.innerHTML + '<br>' + message;
}

