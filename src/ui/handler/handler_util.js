// @flow

import assert from 'assert';

export function indexTouches(touches: Array<Touch>, points: Array<Point>) {
    assert(touches.length === points.length);
    const obj = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}

export function getTouchesById(e: TouchEvent, points: Array<Point>, identifiers: Array<Number> | [number, number]) {
    const touches = indexTouches(e.targetTouches, points);
    return identifiers.map(id => touches[id]);
}

export function log(message: any, overwrite: any) {
    const log = document.getElementById('log');
    if (overwrite) log.innerHTML = message;
    else log.innerHTML = log.innerHTML + '<br>' + message;
}

