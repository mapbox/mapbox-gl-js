// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';

export default {
    name: 'winkelTripel',
    center: [0, 0],
    range: [3.5, 7],

    project(lng: number, lat: number) {
        lat = lat / 180 * Math.PI;
        lng = lng / 180 * Math.PI;
        const phi1 = Math.acos(2 / Math.PI);
        const alpha = Math.acos(Math.cos(lat) * Math.cos(lng / 2));
        const x = 0.5 * (lng * Math.cos(phi1) + (2 * Math.cos(lat) * Math.sin(lng / 2)) / (Math.sin(alpha) / alpha)) || 0;
        const y = 0.5 * (lat + Math.sin(lat) / (Math.sin(alpha) / alpha)) || 0;
        return {
            x: (x / Math.PI + 0.5) * 0.5,
            y: 1 - (y / Math.PI + 0.5) * 0.5
        };
    },

    unproject(x: number, y: number) {
        // based on https://github.com/d3/d3-geo-projection, MIT-licensed
        x = (2 * x - 0.5) * Math.PI;
        y = (2 * (1 - y) - 0.5) * Math.PI;
        let lambda = x;
        let phi = y;
        let i = 25;
        const epsilon = 1e-6;
        let dlambda = 0, dphi = 0;
        do {
            const cosphi = Math.cos(phi),
                sinphi = Math.sin(phi),
                sinphi2 = 2 * sinphi * cosphi,
                sin2phi = sinphi * sinphi,
                cos2phi = cosphi * cosphi,
                coslambda2 = Math.cos(lambda / 2),
                sinlambda2 = Math.sin(lambda / 2),
                sinlambda = 2 * coslambda2 * sinlambda2,
                sin2lambda2 = sinlambda2 * sinlambda2,
                C = 1 - cos2phi * coslambda2 * coslambda2,
                F = C ? 1 / C : 0,
                E = C ? Math.acos(cosphi * coslambda2) * Math.sqrt(1 / C) : 0,
                fx = 0.5 * (2 * E * cosphi * sinlambda2 + lambda * 2 / Math.PI) - x,
                fy = 0.5 * (E * sinphi + phi) - y,
                dxdlambda = 0.5 * F * (cos2phi * sin2lambda2 + E * cosphi * coslambda2 * sin2phi) + 1 / Math.PI,
                dxdphi = F * (sinlambda * sinphi2 / 4 - E * sinphi * sinlambda2),
                dydlambda = 0.125 * F * (sinphi2 * sinlambda2 - E * sinphi * cos2phi * sinlambda),
                dydphi = 0.5 * F * (sin2phi * coslambda2 + E * sin2lambda2 * cosphi) + 0.5,
                denominator = dxdphi * dydlambda - dydphi * dxdlambda;

            dlambda = (fy * dxdphi - fx * dydphi) / denominator;
            dphi = (fx * dydlambda - fy * dxdlambda) / denominator;
            lambda -= dlambda;
            phi -= dphi;
        } while ((Math.abs(dlambda) > epsilon || Math.abs(dphi) > epsilon) && --i > 0);

        const lng = clamp(lambda * 180 / Math.PI, -180, 180);
        const lat = clamp(phi * 180 / Math.PI, -90, 90);

        return new LngLat(lng, lat);
    }
};
