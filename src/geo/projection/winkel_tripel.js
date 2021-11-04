// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';

const maxPhi = degToRad(MAX_MERCATOR_LATITUDE);

export default {
    name: 'winkelTripel',
    center: [0, 0],
    range: [3.5, 7],

    project(lng: number, lat: number) {
        lat = degToRad(lat);
        lng = degToRad(lng);
        const cosLat = Math.cos(lat);
        const twoOverPi = 2 / Math.PI;
        const alpha = Math.acos(cosLat * Math.cos(lng / 2));
        const sinAlphaOverAlpha = Math.sin(alpha) / alpha;
        const x = 0.5 * (lng * twoOverPi + (2 * cosLat * Math.sin(lng / 2)) / sinAlphaOverAlpha) || 0;
        const y = 0.5 * (lat + Math.sin(lat) / sinAlphaOverAlpha) || 0;
        return {
            x: (x / Math.PI + 0.5) * 0.5,
            y: 1 - (y / Math.PI + 1) * 0.5
        };
    },

    unproject(x: number, y: number) {
        // based on https://github.com/d3/d3-geo-projection, MIT-licensed
        x = (2 * x - 0.5) * Math.PI;
        y = (2 * (1 - y) - 1) * Math.PI;
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
            lambda = clamp(lambda - dlambda, -Math.PI, Math.PI);
            phi = clamp(phi - dphi, -maxPhi, maxPhi);

        } while ((Math.abs(dlambda) > epsilon || Math.abs(dphi) > epsilon) && --i > 0);

        return new LngLat(radToDeg(lambda), radToDeg(phi));
    }
};
