// @flow

import assert from 'assert';

export function indexTouches(touches: TouchList, points: Array<Point>) {
    assert(touches.length === points.length);
    const obj = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}

export function getTouchesById(e: TouchEvent, points: Array<Point>, identifiers: [number, number]) {
    const touches = indexTouches(e.targetTouches, points);
    return [touches[identifiers[0]], touches[identifiers[1]]];
}

export function log(message: any, overwrite: any) {
    const log = document.getElementById('log');
    if (log) {
        if (overwrite) log.innerHTML = message;
        else log.innerHTML = log.innerHTML + '<br>' + message;
    }
}

