import assert from 'assert';

import type Point from '@mapbox/point-geometry';

/**
 * @private
 */
export function indexTouches(touches: Array<Touch>, points: Array<Point>): Partial<Record<number | string, Point>> {
    assert(touches.length === points.length);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: Record<string, any> = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}
