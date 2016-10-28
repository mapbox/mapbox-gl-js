'use strict';

const Point = require('point-geometry');
const loadGeometry = require('./load_geometry');
const EXTENT = require('./extent');
const featureFilter = require('feature-filter');
const createStructArrayType = require('../util/struct_array');
const Grid = require('grid-index');
const DictionaryCoder = require('../util/dictionary_coder');
const vt = require('vector-tile');
const Protobuf = require('pbf');
const GeoJSONFeature = require('../util/vectortile_to_geojson');
const arraysIntersect = require('../util/util').arraysIntersect;

const intersection = require('../util/intersection_tests');
const multiPolygonIntersectsBufferedMultiPoint = intersection.multiPolygonIntersectsBufferedMultiPoint;
const multiPolygonIntersectsMultiPolygon = intersection.multiPolygonIntersectsMultiPolygon;
const multiPolygonIntersectsBufferedMultiLine = intersection.multiPolygonIntersectsBufferedMultiLine;

const FeatureIndexArray = createStructArrayType({
    members: [
        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' }
    ]
});

class FeatureIndex {
    constructor(coord, overscaling, collisionTile) {
        if (coord.grid) {
            const serialized = coord;
            const rawTileData = overscaling;
            coord = serialized.coord;
            overscaling = serialized.overscaling;
            this.grid = new Grid(serialized.grid);
            this.featureIndexArray = new FeatureIndexArray(serialized.featureIndexArray);
            this.rawTileData = rawTileData;
            this.bucketLayerIDs = serialized.bucketLayerIDs;
        } else {
            this.grid = new Grid(EXTENT, 16, 0);
            this.featureIndexArray = new FeatureIndexArray();
        }
        this.coord = coord;
        this.overscaling = overscaling;
        this.x = coord.x;
        this.y = coord.y;
        this.z = coord.z - Math.log(overscaling) / Math.LN2;
        this.setCollisionTile(collisionTile);
    }

    insert(feature, bucketIndex) {
        const key = this.featureIndexArray.length;
        this.featureIndexArray.emplaceBack(feature.index, feature.sourceLayerIndex, bucketIndex);
        const geometry = loadGeometry(feature);

        for (let r = 0; r < geometry.length; r++) {
            const ring = geometry[r];

            const bbox = [Infinity, Infinity, -Infinity, -Infinity];
            for (let i = 0; i < ring.length; i++) {
                const p = ring[i];
                bbox[0] = Math.min(bbox[0], p.x);
                bbox[1] = Math.min(bbox[1], p.y);
                bbox[2] = Math.max(bbox[2], p.x);
                bbox[3] = Math.max(bbox[3], p.y);
            }

            this.grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
        }
    }

    setCollisionTile(collisionTile) {
        this.collisionTile = collisionTile;
    }

    serialize(transferables) {
        const grid = this.grid.toArrayBuffer();
        if (transferables) {
            transferables.push(grid);
        }
        return {
            coord: this.coord,
            overscaling: this.overscaling,
            grid: grid,
            featureIndexArray: this.featureIndexArray.serialize(transferables),
            bucketLayerIDs: this.bucketLayerIDs
        };
    }

    // Finds features in this tile at a particular position.
    query(args, styleLayers) {
        if (!this.vtLayers) {
            this.vtLayers = new vt.VectorTile(new Protobuf(this.rawTileData)).layers;
            this.sourceLayerCoder = new DictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
        }

        const result = {};

        const params = args.params || {},
            pixelsToTileUnits = EXTENT / args.tileSize / args.scale,
            filter = featureFilter(params.filter);

        // Features are indexed their original geometries. The rendered geometries may
        // be buffered, translated or offset. Figure out how much the search radius needs to be
        // expanded by to include these features.
        let additionalRadius = 0;
        for (const id in styleLayers) {
            const styleLayer = styleLayers[id];
            const paint = styleLayer.paint;

            let styleLayerDistance = 0;
            if (styleLayer.type === 'line') {
                styleLayerDistance = getLineWidth(paint) / 2 + Math.abs(paint['line-offset']) + translateDistance(paint['line-translate']);
            } else if (styleLayer.type === 'fill') {
                styleLayerDistance = translateDistance(paint['fill-translate']);
            } else if (styleLayer.type === 'fill-extrusion') {
                styleLayerDistance = translateDistance(paint['fill-extrusion-translate']);
            } else if (styleLayer.type === 'circle') {
                styleLayerDistance = paint['circle-radius'] + translateDistance(paint['circle-translate']);
            }
            additionalRadius = Math.max(additionalRadius, styleLayerDistance * pixelsToTileUnits);
        }

        const queryGeometry = args.queryGeometry.map((q) => {
            return q.map((p) => {
                return new Point(p.x, p.y);
            });
        });

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < queryGeometry.length; i++) {
            const ring = queryGeometry[i];
            for (let k = 0; k < ring.length; k++) {
                const p = ring[k];
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
        }

        const matching = this.grid.query(minX - additionalRadius, minY - additionalRadius, maxX + additionalRadius, maxY + additionalRadius);
        matching.sort(topDownFeatureComparator);
        this.filterMatching(result, matching, this.featureIndexArray, queryGeometry, filter, params.layers, styleLayers, args.bearing, pixelsToTileUnits);

        const matchingSymbols = this.collisionTile.queryRenderedSymbols(queryGeometry, args.scale);
        matchingSymbols.sort();
        this.filterMatching(result, matchingSymbols, this.collisionTile.collisionBoxArray, queryGeometry, filter, params.layers, styleLayers, args.bearing, pixelsToTileUnits);

        return result;
    }

    filterMatching(result, matching, array, queryGeometry, filter, filterLayerIDs, styleLayers, bearing, pixelsToTileUnits) {
        let previousIndex;
        for (let k = 0; k < matching.length; k++) {
            const index = matching[k];

            // don't check the same feature more than once
            if (index === previousIndex) continue;
            previousIndex = index;

            const match = array.get(index);

            const layerIDs = this.bucketLayerIDs[match.bucketIndex];
            if (filterLayerIDs && !arraysIntersect(filterLayerIDs, layerIDs)) continue;

            const sourceLayerName = this.sourceLayerCoder.decode(match.sourceLayerIndex);
            const sourceLayer = this.vtLayers[sourceLayerName];
            const feature = sourceLayer.feature(match.featureIndex);

            if (!filter(feature)) continue;

            let geometry = null;

            for (let l = 0; l < layerIDs.length; l++) {
                const layerID = layerIDs[l];

                if (filterLayerIDs && filterLayerIDs.indexOf(layerID) < 0) {
                    continue;
                }

                const styleLayer = styleLayers[layerID];
                if (!styleLayer) continue;

                let translatedPolygon;
                if (styleLayer.type !== 'symbol') {
                    // all symbols already match the style

                    if (!geometry) geometry = loadGeometry(feature);

                    const paint = styleLayer.paint;

                    if (styleLayer.type === 'line') {
                        translatedPolygon = translate(queryGeometry,
                                paint['line-translate'], paint['line-translate-anchor'],
                                bearing, pixelsToTileUnits);
                        const halfWidth = getLineWidth(paint) / 2 * pixelsToTileUnits;
                        if (paint['line-offset']) {
                            geometry = offsetLine(geometry, paint['line-offset'] * pixelsToTileUnits);
                        }
                        if (!multiPolygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth)) continue;

                    } else if (styleLayer.type === 'fill' || styleLayer.type === 'fill-extrusion') {
                        const typePrefix = styleLayer.type;
                        translatedPolygon = translate(queryGeometry,
                                paint[`${typePrefix}-translate`], paint[`${typePrefix}-translate-anchor`],
                                bearing, pixelsToTileUnits);
                        if (!multiPolygonIntersectsMultiPolygon(translatedPolygon, geometry)) continue;

                    } else if (styleLayer.type === 'circle') {
                        translatedPolygon = translate(queryGeometry,
                                paint['circle-translate'], paint['circle-translate-anchor'],
                                bearing, pixelsToTileUnits);
                        const circleRadius = paint['circle-radius'] * pixelsToTileUnits;
                        if (!multiPolygonIntersectsBufferedMultiPoint(translatedPolygon, geometry, circleRadius)) continue;
                    }
                }

                const geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y);
                geojsonFeature.layer = styleLayer.serialize();
                let layerResult = result[layerID];
                if (layerResult === undefined) {
                    layerResult = result[layerID] = [];
                }
                layerResult.push(geojsonFeature);
            }
        }
    }
}

module.exports = FeatureIndex;

function translateDistance(translate) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

function topDownFeatureComparator(a, b) {
    return b - a;
}

function getLineWidth(paint) {
    if (paint['line-gap-width'] > 0) {
        return paint['line-gap-width'] + 2 * paint['line-width'];
    } else {
        return paint['line-width'];
    }
}

function translate(queryGeometry, translate, translateAnchor, bearing, pixelsToTileUnits) {
    if (!translate[0] && !translate[1]) {
        return queryGeometry;
    }

    translate = Point.convert(translate);

    if (translateAnchor === "viewport") {
        translate._rotate(-bearing);
    }

    const translated = [];
    for (let i = 0; i < queryGeometry.length; i++) {
        const ring = queryGeometry[i];
        const translatedRing = [];
        for (let k = 0; k < ring.length; k++) {
            translatedRing.push(ring[k].sub(translate._mult(pixelsToTileUnits)));
        }
        translated.push(translatedRing);
    }
    return translated;
}

function offsetLine(rings, offset) {
    const newRings = [];
    const zero = new Point(0, 0);
    for (let k = 0; k < rings.length; k++) {
        const ring = rings[k];
        const newRing = [];
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i - 1];
            const b = ring[i];
            const c = ring[i + 1];
            const aToB = i === 0 ? zero : b.sub(a)._unit()._perp();
            const bToC = i === ring.length - 1 ? zero : c.sub(b)._unit()._perp();
            const extrude = aToB._add(bToC)._unit();

            const cosHalfAngle = extrude.x * bToC.x + extrude.y * bToC.y;
            extrude._mult(1 / cosHalfAngle);

            newRing.push(extrude._mult(offset)._add(b));
        }
        newRings.push(newRing);
    }
    return newRings;
}
