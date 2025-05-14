import assert from 'assert';

import type Point from '@mapbox/point-geometry';

/**
 * @private
 */
export function indexTouches(touches: Array<Touch>, points: Array<Point>): Partial<Record<number | string, Point>> {
    assert(touches.length === points.length);
    const obj: Record<string, Point> = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}
