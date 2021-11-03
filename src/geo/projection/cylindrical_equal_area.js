// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';

export default function(phi) {
    const cosPhi = Math.cos(phi);

    return {
        // wrap: true,
        project(lng: number, lat: number) {
            const x = degToRad(lng) * cosPhi;
            const y = Math.sin(degToRad(lat)) / cosPhi;

            return {
                x: 1 + 0.5 * x,
                y: 1 - 0.5 * y
            };
        },
        unproject(x: number, y: number) {
            // debugger;
            // const cosPhi = Math.cos(phi);
            const x_ = (x - 1) * 2;
            const y_ = (y - 1) * -2;
            const lng = clamp(radToDeg(x_) / cosPhi, -180, 180);
            const y2 = radToDeg(y_) * cosPhi;
            const y3 = Math.asin(clamp(y2, -1, 1));
            const lat = clamp(y3, -90, 90);

            return new LngLat(lng, lat);
        }
    };
}
