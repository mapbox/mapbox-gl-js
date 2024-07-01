
import EXTENT from '../style-spec/data/extent';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';

import type WorkerTile from './worker_tile';
import type {Feature} from './geojson_wrapper';

type BBox = {
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
}

type InternalFeature = BBox & {
    id: string | number,
    tags: {[_: string]: string | number | boolean},
    type: 1 | 2 | 3,
    geometry: number[] | number[][]
};

const PAD = 64 / 4096; // geojson-vt default tile buffer

/*
 * A GeoJSON index tailored to "small data, updated frequently" use cases
 * which gets used with GeoJSON sources in `dynamic` mode
 */
export default class GeoJSONRT {
    features: Map<number | string, InternalFeature>;

    constructor() {
        this.features = new Map();
    }

    clear() {
        this.features.clear();
    }

    load(features: GeoJSON.Feature[] = [], cache: {[_: number]: WorkerTile}) {
        for (const feature of features) {
            const id = feature.id;
            if (id == null) continue;

            let updated = this.features.get(id);

            // update tile cache for the old position
            if (updated) this.updateCache(updated, cache);

            if (!feature.geometry) {
                this.features.delete(id);
            } else {
                updated = convertFeature(feature);
                // update tile cache for the new position
                this.updateCache(updated, cache);
                this.features.set(id, updated);
            }

            this.updateCache(updated, cache);
        }
    }

    // clear all tiles that contain a given feature from the tile cache
    updateCache(feature: InternalFeature, cache: {[_: number]: WorkerTile}) {
        for (const {canonical, uid} of Object.values(cache)) {
            const {z, x, y} = canonical;
            const z2 = Math.pow(2, z);

            if (intersectsTile(feature, z2, x, y)) {
                delete cache[uid];
            }
        }
    }

    // return all features that fit in the tile (plus a small padding) by bbox; since dynamic mode is
    // for "small data, frequently updated" case, linear loop through all features should be fast enough
    getTile(z: number, tx: number, ty: number) {
        const z2 = Math.pow(2, z);
        const features = [];
        for (const feature of this.features.values()) {
            if (intersectsTile(feature, z2, tx, ty)) {
                features.push(outputFeature(feature, z2, tx, ty));
            }
        }
        return {features};
    }

    getFeatures() {
        return [...this.features.values()];
    }
}

function intersectsTile({minX, minY, maxX, maxY}: BBox, z2: number, tx: number, ty: number) {
    const x0 = (tx - PAD) / z2;
    const y0 = (ty - PAD) / z2;
    const x1 = (tx + 1 + PAD) / z2;
    const y1 = (ty + 1 + PAD) / z2;
    return minX < x1 && minY < y1 && maxX > x0 && maxY > y0;
}

function convertFeature(originalFeature: GeoJSON.Feature): InternalFeature {
    const {id, geometry, properties} = originalFeature;
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') {
        throw new Error('GeometryCollection not supported in dynamic mode.');
    }
    const {type, coordinates} = geometry;

    const feature: InternalFeature = {
        id,
        type: 1,
        geometry: [],
        tags: properties,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    };
    const geom = feature.geometry;

    if (type === 'Point') {
        convertPoint(coordinates, geom as number[], feature);

    } else if (type === 'MultiPoint') {
        for (const p of coordinates) {
            convertPoint(p, geom as number[], feature);
        }

    } else if (type === 'LineString') {
        feature.type = 2;
        convertLine(coordinates, geom as number[][], feature);

    } else if (type === 'MultiLineString') {
        feature.type = 2;
        convertLines(coordinates, geom as number[][], feature);

    } else if (type === 'Polygon') {
        feature.type = 3;
        convertLines(coordinates, geom as number[][], feature, true);

    } else if (type === 'MultiPolygon') {
        feature.type = 3;
        for (const polygon of coordinates) {
            convertLines(polygon, geom as number[][], feature, true);
        }

    } else {
        throw new Error('Input data is not a valid GeoJSON object.');
    }

    return feature;
}

function convertPoint([lng, lat]: GeoJSON.Position, out: number[], bbox: BBox) {
    const x = mercatorXfromLng(lng);
    let y = mercatorYfromLat(lat);
    y = y < 0 ? 0 : y > 1 ? 1 : y;
    out.push(x, y);

    bbox.minX = Math.min(bbox.minX, x);
    bbox.minY = Math.min(bbox.minY, y);
    bbox.maxX = Math.max(bbox.maxX, x);
    bbox.maxY = Math.max(bbox.maxY, y);
}

function convertLine(ring: GeoJSON.Position[], out: number[][], bbox: BBox, isPolygon: boolean = false, isOuter: boolean = false) {
    const newLine: number[] = [];
    for (const p of ring) {
        convertPoint(p, newLine, bbox);
    }
    out.push(newLine);
    if (isPolygon) rewind(newLine, isOuter);
}

function convertLines(lines: GeoJSON.Position[][], out: number[][], bbox: BBox, isPolygon: boolean = false) {
    for (let i = 0; i < lines.length; i++) {
        convertLine(lines[i], out, bbox, isPolygon, i === 0);
    }
}

function outputFeature(feature: InternalFeature, z2: number, tx: number, ty: number): Feature {
    const {id, type, geometry, tags} = feature;
    const tileGeom = [];

    if (type === 1) {
        transformLine(geometry as number[], z2, tx, ty, tileGeom);
    } else {
        for (const ring of geometry) {
            tileGeom.push(transformLine(ring as number[], z2, tx, ty));
        }
    }

    return {
        id,
        type,
        geometry: tileGeom,
        tags
    };
}

function transformLine(line: number[], z2: number, tx: number, ty: number, out: [number, number][] = []) {
    for (let i = 0; i < line.length; i += 2) {
        out.push(transformPoint(line[i], line[i + 1], z2, tx, ty));
    }
    return out;
}

function transformPoint(x: number, y: number, z2: number, tx: number, ty: number): [number, number] {
    return [
        Math.round(EXTENT * (x * z2 - tx)),
        Math.round(EXTENT * (y * z2 - ty))
    ];
}

// rewind a polygon ring to a given winding order (clockwise or anti-clockwise)
function rewind(ring: number[], clockwise: boolean) {
    let area = 0;
    for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
        area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
    }
    if (area > 0 === clockwise) {
        for (let i = 0, len = ring.length; i < len / 2; i += 2) {
            const x = ring[i];
            const y = ring[i + 1];
            ring[i] = ring[len - 2 - i];
            ring[i + 1] = ring[len - 1 - i];
            ring[len - 2 - i] = x;
            ring[len - 1 - i] = y;
        }
    }
}
