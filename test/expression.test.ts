// eslint-disable-next-line import/extensions
import {run} from './integration/lib/expression';
import {createPropertyExpression} from '../src/style-spec/expression/index';
import {isFunction} from '../src/style-spec/function/index';
import convertFunction from '../src/style-spec/function/convert';
import {toString} from '../src/style-spec/expression/types';
// eslint-disable-next-line import/extensions
import ignores from './ignores/all';
import {CanonicalTileID} from '../src/source/tile_id';
import MercatorCoordinate from '../src/geo/mercator_coordinate';
import tileTransform, {getTilePoint} from '../src/geo/projection/tile_transform';
import {getProjection} from '../src/geo/projection/index';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const projection = getProjection({name: 'mercator'});

// @ts-expect-error - DOMMatrix is not defined in Node.js
global.DOMMatrix = class {};

function getPoint(coord, canonical) {
    const tileTr = tileTransform(canonical, projection);
    const p = getTilePoint(tileTr, MercatorCoordinate.fromLngLat({lng: coord[0], lat: coord[1]}, 0));
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    return p;
}

function convertPoint(coord, canonical, out) {
    out.push([getPoint(coord, canonical)]);
}

function convertPoints(coords, canonical, out) {
    for (let i = 0; i < coords.length; i++) {
        convertPoint(coords[i], canonical, out);
    }
}

function convertLine(line, canonical, out) {
    const l: Array<any> = [];
    for (let i = 0; i < line.length; i++) {
        l.push(getPoint(line[i], canonical));
    }
    out.push(l);
}

function convertLines(lines, canonical, out) {
    for (let i = 0; i < lines.length; i++) {
        convertLine(lines[i], canonical, out);
    }
}

function getGeometry(feature, geometry, canonical) {
    if (geometry.coordinates) {
        const coords = geometry.coordinates;
        const type = geometry.type;
        feature.type = type;
        feature.geometry = [];
        if (type === 'Point') {
            convertPoint(coords, canonical, feature.geometry);
        } else if (type === 'MultiPoint') {
            feature.type = 'Point';
            convertPoints(coords, canonical, feature.geometry);
        } else if (type === 'LineString') {
            convertLine(coords, canonical, feature.geometry);
        } else if (type === 'MultiLineString') {
            feature.type = 'LineString';
            convertLines(coords, canonical, feature.geometry);
        } else if (type === 'Polygon') {
            convertLines(coords, canonical, feature.geometry);
        } else if (type === 'MultiPolygon') {
            feature.type = 'Polygon';
            for (let i = 0; i < coords.length; i++) {
                convertLines(coords[i], canonical, feature.geometry);
            }
        }
    }
}

let tests: any;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

run('js', {ignores, tests}, (fixture) => {
    const spec = Object.assign({}, fixture.propertySpec);
    let availableImages: any;
    let canonical: any;

    if (!spec['property-type']) {
        spec['property-type'] = 'data-driven';
    }

    if (!spec['expression']) {
        spec['expression'] = {
            'interpolated': true,
            'parameters': ['zoom', 'feature']
        };
    }

    const evaluateExpression = (expression, compilationResult) => {
        if (expression.result === 'error') {
            compilationResult.result = 'error';
            compilationResult.errors = expression.value.map((err) => ({
                key: err.key,
                error: err.message
            }));
            return;
        }

        const evaluationResult: Array<any> = [];

        expression = expression.value;
        const type = expression._styleExpression.expression.type; // :scream:

        compilationResult.result = 'success';
        compilationResult.isFeatureConstant = expression.kind === 'constant' || expression.kind === 'camera';
        compilationResult.isZoomConstant = expression.kind === 'constant' || expression.kind === 'source';
        compilationResult.type = toString(type);

        for (const input of fixture.inputs || []) {
            try {
                const feature = {properties: input[1].properties || {}} as GeoJSON.Feature;
                availableImages = input[0].availableImages || [];
                if ('canonicalID' in input[0]) {
                    const id = input[0].canonicalID;
                    canonical = new CanonicalTileID(id.z, id.x, id.y);
                } else {
                    canonical = null;
                }

                if ('id' in input[1]) {
                    feature.id = input[1].id;
                }
                if ('geometry' in input[1]) {
                    if (canonical !== null) {
                        getGeometry(feature, input[1].geometry, canonical);
                    } else {
                        feature.type = input[1].geometry.type;
                    }
                }

                let value = expression.evaluateWithoutErrorHandling(input[0], feature, {}, canonical, availableImages);

                if (type.kind === 'color') {
                    value = [value.r, value.g, value.b, value.a];
                }
                evaluationResult.push(value);
            } catch (error: any) {
                if (error.name === 'ExpressionEvaluationError') {
                    evaluationResult.push({error: error.toJSON()});
                } else {
                    evaluationResult.push({error: error.message});
                }
            }
        }

        if (fixture.inputs) {
            return evaluationResult;
        }
    };

    const result = {compiled: {}, recompiled: {}} as {compiled: any, recompiled: any, outputs: unknown, serialized: unknown, roundTripOutputs: unknown};
    const expression = (() => {
        if (isFunction(fixture.expression)) {
            return createPropertyExpression(convertFunction(fixture.expression, spec), spec);
        } else {
            return createPropertyExpression(fixture.expression, spec);
        }
    })();

    result.outputs = evaluateExpression(expression, result.compiled);
    if (expression.result === 'success') {
        // @ts-expect-error - Property '_styleExpression' does not exist on type 'StylePropertyExpression'.
        result.serialized = expression.value._styleExpression.expression.serialize();
        result.roundTripOutputs = evaluateExpression(
            createPropertyExpression(result.serialized, spec),
            result.recompiled);
        // Type is allowed to change through serialization
        // (eg "array" -> "array<number, 3>")
        // Override the round-tripped type here so that the equality check passes
        result.recompiled.type = result.compiled.type;
    }

    // Narrow down result to JSON
    return JSON.parse(JSON.stringify(result));
});
