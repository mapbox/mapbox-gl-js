'use strict';

const Bucket = require('../bucket');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const Point = require('point-geometry');
const EARCUT_MAX_RINGS = 500;

const fillExtrusionInterfaces = {
    fillextrusion: {
        layoutVertexArrayType: new Bucket.VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }, {
            name: 'a_normal',
            components: 3,
            type: 'Int16'
        }, {
            name: 'a_edgedistance',
            components: 1,
            type: 'Int16'
        }]),
        elementArrayType: new Bucket.ElementArrayType(3),

        paintAttributes: [{
            name: 'a_minH',
            components: 1,
            type: 'Uint16',
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("fill-extrude-base", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'fill-extrude-base'
        }, {
            name: 'a_maxH',
            components: 1,
            type: 'Uint16',
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("fill-extrude-height", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'fill-extrude-height'
        }, {
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: (layer, globalProperties, featureProperties) => {
                const color = layer.getPaintValue("fill-color", globalProperties, featureProperties);
                color[3] = 1.0;
                return color;
            },
            multiplier: 255,
            paintProperty: 'fill-color'
        }]
    }
};

class FillExtrusionBucket extends Bucket {
    get programInterfaces() {
        return fillExtrusionInterfaces;
    }

    addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
        return vertexArray.emplaceBack(
            // a_pos
            x,
            y,
            // a_normal
            Math.floor(nx * this.factor) * 2 + t,
            ny * this.factor * 2,
            nz * this.factor * 2,

            // a_edgedistance
            Math.round(e)
            );
    }

    addFeature(feature) {
        const lines = loadGeometry(feature);
        const polygons = convertCoords(classifyRings(lines, EARCUT_MAX_RINGS));

        this.factor = Math.pow(2, 13);

        const startGroup = this.prepareArrayGroup('fillextrusion', 0);
        const startIndex = startGroup.layoutVertexArray.length;

        for (let i = 0; i < polygons.length; i++) {
            this.addPolygon(polygons[i]);
        }

        this.populatePaintArrays('fillextrusion', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
    }

    addPolygon(polygon) {
        let numVertices = 0;
        for (let k = 0; k < polygon.length; k++) {
            numVertices += polygon[k].length;
        }
        numVertices *= 5;

        const group = this.prepareArrayGroup('fillextrusion', numVertices);
        const flattened = [];
        const holeIndices = [];

        const indices = [];

        for (let r = 0; r < polygon.length; r++) {
            const ring = polygon[r];

            if (r > 0) holeIndices.push(flattened.length / 2);

            let edgeDistance = 0;

            for (let v = 0; v < ring.length; v++) {
                const v1 = ring[v];

                const index = this.addVertex(group.layoutVertexArray, v1[0], v1[1], 0, 0, 1, 1, 0);
                indices.push(index);

                if (v >= 1) {
                    const v2 = ring[v - 1];

                    if (!isBoundaryEdge(v1, v2)) {
                        const perp = Point.convert(v1)._sub(Point.convert(v2))._perp()._unit();

                        const bottomRight = this.addVertex(group.layoutVertexArray, v1[0], v1[1], perp.x, perp.y, 0, 0, edgeDistance);
                        this.addVertex(group.layoutVertexArray, v1[0], v1[1], perp.x, perp.y, 0, 1, edgeDistance);

                        edgeDistance += Point.convert(v2).dist(Point.convert(v1));

                        this.addVertex(group.layoutVertexArray, v2[0], v2[1], perp.x, perp.y, 0, 0, edgeDistance);
                        this.addVertex(group.layoutVertexArray, v2[0], v2[1], perp.x, perp.y, 0, 1, edgeDistance);

                        group.elementArray.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                        group.elementArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);
                    }
                }

                // convert to format used by earcut
                flattened.push(v1[0]);
                flattened.push(v1[1]);
            }
        }

        const triangleIndices = earcut(flattened, holeIndices);

        for (let j = 0; j < triangleIndices.length - 2; j += 3) {
            group.elementArray.emplaceBack(indices[triangleIndices[j]],
                indices[triangleIndices[j + 1]],
                indices[triangleIndices[j + 2]]);
        }
    }
}

module.exports = FillExtrusionBucket;

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}

function isBoundaryEdge(v1, v2) {
    return v1.some((a, i) => {
        return isOutside(v2[i]) && v2[i] === a;
    });
}

function isOutside(coord) {
    return coord < 0 || coord > EXTENT;
}
