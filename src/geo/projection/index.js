// @flow
import LngLat from '../lng_lat.js';
import globe from './globe.js';
import mercator from './mercator.js';

export type Projection = {
    name: string,
    project: (lng: number, lat: number) => {x: number, y: number, z: number},
    //unproject: (x: number, y: number) => LngLat

    requiresDraping: boolean,
    supportsWorldCopies: boolean,
    supportsWorldCopies: boolean,
    zAxisUnit: "meters" | "pixels",

    pixelsPerMeter: (lat: number, worldSize: number) => Number,    
};

const projections = {
    globe,
    mercator
};

export default function getProjection(name: string) {
    return projections[name];
}