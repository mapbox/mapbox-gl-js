// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';

export default function(phi: number) {
    const cosPhi = Math.cos(degToRad(phi));
    // scale coordinates between 0 and 1 to avoid constraint issues
    const scale = 1 / (2 * Math.max(Math.PI * cosPhi, 1 / cosPhi));

    return {
        wrap: true,
        project(lng: number, lat: number) {
            const x = degToRad(lng) * cosPhi;
            const y = Math.sin(degToRad(lat)) / cosPhi;

            return {
                x: (x * scale) + 0.5,
                y: (-y * scale) + 0.5,
            };
        },
        unproject(x: number, y: number) {
            const x_ = (x - 0.5) / scale;
            const y_ = -(y - 0.5) / scale;
            const lng = clamp(radToDeg(x_) / cosPhi, -180, 180);
            const y2 = y_ * cosPhi;
            const y3 = Math.asin(clamp(y2, -1, 1));
            const lat = clamp(radToDeg(y3), -90, 90);

            return new LngLat(lng, lat);
        }
    };
}
