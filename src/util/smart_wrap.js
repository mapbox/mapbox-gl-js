// @flow

import LngLat from '../geo/lng_lat.js';

import type Point from '@mapbox/point-geometry';
import type Transform from '../geo/transform.js';

/**
 * Given a LngLat, prior projected position, and a transform, return a new LngLat shifted
 * n × 360° east or west for some n ≥ 0 such that:
 *
 * * the projected location of the result is on screen, if possible, and secondarily:
 * * the difference between the projected location of the result and the prior position
 *   is minimized.
 *
 * The object is to preserve perceived object constancy for Popups and Markers as much as
 * possible; they should avoid shifting large distances across the screen, even when the
 * map center changes by ±360° due to automatic wrapping, and when about to go off screen,
 * should wrap just enough to avoid doing so.
 *
 * @private
 */
export default function(lngLat: LngLat, priorPos: ?Point, transform: Transform): LngLat {
    lngLat = new LngLat(lngLat.lng, lngLat.lat);

    // First, try shifting one world in either direction, and see if either is closer to the
    // prior position. Don't shift away if it new position is further from center.
    // This preserves object constancy when the map center is auto-wrapped during animations,
    // but don't allow it to run away on horizon (points towards horizon get closer and closer).
    if (priorPos) {
        const left  = new LngLat(lngLat.lng - 360, lngLat.lat);
        const right = new LngLat(lngLat.lng + 360, lngLat.lat);
        // Unless offscreen, keep the marker within same wrap distance to center. This is to prevent
        // running it to infinity `lng` near horizon when bearing is ~90°.
        const withinWrap =  Math.ceil(Math.abs(lngLat.lng - transform.center.lng) / 360) * 360;
        const delta = transform.locationPoint(lngLat).distSqr(priorPos);
        const offscreen = priorPos.x < 0 || priorPos.y < 0 || priorPos.x > transform.width || priorPos.y > transform.height;
        if (transform.locationPoint(left).distSqr(priorPos) < delta && (offscreen || Math.abs(left.lng - transform.center.lng) < withinWrap)) {
            lngLat = left;
        } else if (transform.locationPoint(right).distSqr(priorPos) < delta && (offscreen || Math.abs(right.lng - transform.center.lng) < withinWrap)) {
            lngLat = right;
        }
    }

    // Second, wrap toward the center until the new position is on screen, or we can't get
    // any closer.
    while (Math.abs(lngLat.lng - transform.center.lng) > 180) {
        const pos = transform.locationPoint(lngLat);
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= transform.width && pos.y <= transform.height) {
            break;
        }
        if (lngLat.lng > transform.center.lng) {
            lngLat.lng -= 360;
        } else {
            lngLat.lng += 360;
        }
    }

    return lngLat;
}
