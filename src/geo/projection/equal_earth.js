// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';

const a1 = 1.340264;
const a2 = -0.081106;
const a3 = 0.000893;
const a4 = 0.003796;
const M = Math.sqrt(3) / 2;

export default {
    name: 'equalEarth',
    center: [0, 0],
    range: [3.5, 7],

    project(lng: number, lat: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        lat = lat / 180 * Math.PI;
        lng = lng / 180 * Math.PI;
        const theta = Math.asin(M * Math.sin(lat));
        const theta2 = theta * theta;
        const theta6 = theta2 * theta2 * theta2;
        const x = lng * Math.cos(theta) / (M * (a1 + 3 * a2 * theta2 + theta6 * (7 * a3 + 9 * a4 * theta2)));
        const y = theta * (a1 + a2 * theta2 + theta6 * (a3 + a4 * theta2));

        return {
            x: (x / Math.PI + 0.5) * 0.5,
            y: 1 - (y / Math.PI + 1) * 0.5
        };
    },

    unproject(x: number, y: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        x = (2 * x - 0.5) * Math.PI;
        y = (2 * (1 - y) - 1) * Math.PI;
        let theta = y;
        let theta2 = theta * theta;
        let theta6 = theta2 * theta2 * theta2;

        for (let i = 0, delta, fy, fpy; i < 12; ++i) {
            fy = theta * (a1 + a2 * theta2 + theta6 * (a3 + a4 * theta2)) - y;
            fpy = a1 + 3 * a2 * theta2 + theta6 * (7 * a3 + 9 * a4 * theta2);
            delta = fy / fpy;
            theta = clamp(theta - delta, -Math.PI / 3, Math.PI / 3);
            theta2 = theta * theta;
            theta6 = theta2 * theta2 * theta2;
            if (Math.abs(delta) < 1e-12) break;
        }

        const lambda = M * x * (a1 + 3 * a2 * theta2 + theta6 * (7 * a3 + 9 * a4 * theta2)) / Math.cos(theta);
        const phi = Math.asin(Math.sin(theta) / M);
        const lng = clamp(lambda * 180 / Math.PI, -180, 180);
        const lat = clamp(phi * 180 / Math.PI, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

        return new LngLat(lng, lat);
    }
};
