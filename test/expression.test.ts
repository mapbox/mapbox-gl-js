// eslint-disable-next-line import-x/extensions
import {run} from './integration/lib/expression';
import {createPropertyExpression} from '../src/style-spec/expression/index';
import {isFunction} from '../src/style-spec/function/index';
import convertFunction from '../src/style-spec/function/convert';
import {toString} from '../src/style-spec/expression/types';
// eslint-disable-next-line import-x/extensions
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const tileTr = tileTransform(canonical, projection);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const p = getTilePoint(tileTr, MercatorCoordinate.fromLngLat({lng: coord[0], lat: coord[1]}, 0));
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    return p;
}

function convertPoint(coord, canonical, out) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    out.push([getPoint(coord, canonical)]);
}

function convertPoints(coords, canonical, out) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (let i = 0; i < coords.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        convertPoint(coords[i], canonical, out);
    }
}

function convertLine(line, canonical, out) {
    const l: Array<any> = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (let i = 0; i < line.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        l.push(getPoint(line[i], canonical));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    out.push(l);
}

function convertLines(lines, canonical, out) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (let i = 0; i < lines.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        convertLine(lines[i], canonical, out);
    }
}

function getGeometry(feature, geometry, canonical) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (geometry.coordinates) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const coords = geometry.coordinates;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const type = geometry.type;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        feature.type = type;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        feature.geometry = [];
        if (type === 'Point') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            convertPoint(coords, canonical, feature.geometry);
        } else if (type === 'MultiPoint') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            feature.type = 'Point';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            convertPoints(coords, canonical, feature.geometry);
        } else if (type === 'LineString') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            convertLine(coords, canonical, feature.geometry);
        } else if (type === 'MultiLineString') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            feature.type = 'LineString';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            convertLines(coords, canonical, feature.geometry);
        } else if (type === 'Polygon') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            convertLines(coords, canonical, feature.geometry);
        } else if (type === 'MultiPolygon') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            feature.type = 'Polygon';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            for (let i = 0; i < coords.length; i++) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                convertLines(coords[i], canonical, feature.geometry);
            }
        }
    }
}

let tests: any;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
run('js', {ignores, tests}, (fixture) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const spec = Object.assign({}, fixture.propertySpec);
    let availableImages: any;
    let canonical: any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!spec['property-type']) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        spec['property-type'] = 'data-driven';
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!spec['expression']) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        spec['expression'] = {
            'interpolated': true,
            'parameters': ['zoom', 'feature']
        };
    }

    const evaluateExpression = (expression, compilationResult) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (expression.result === 'error') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            compilationResult.result = 'error';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            compilationResult.errors = expression.value.map((err) => ({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                key: err.key,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                error: err.message
            }));
            return;
        }

        const evaluationResult: Array<any> = [];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        expression = expression.value;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const type = expression._styleExpression.expression.type; // :scream:

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        compilationResult.result = 'success';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        compilationResult.isFeatureConstant = expression.kind === 'constant' || expression.kind === 'camera';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        compilationResult.isZoomConstant = expression.kind === 'constant' || expression.kind === 'source';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        compilationResult.type = toString(type);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const input of fixture.inputs || []) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const feature = {properties: input[1].properties || {}} as GeoJSON.Feature;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const featureState = input[2] || {};

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                availableImages = input[0].availableImages || [];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if ('canonicalID' in input[0]) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    const id = input[0].canonicalID;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    canonical = new CanonicalTileID(id.z, id.x, id.y);
                } else {
                    canonical = null;
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if ('id' in input[1]) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    feature.id = input[1].id;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if ('geometry' in input[1]) {
                    if (canonical !== null) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        getGeometry(feature, input[1].geometry, canonical);
                    } else {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        feature.type = input[1].geometry.type;
                    }
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                let value = expression.evaluateWithoutErrorHandling(input[0], feature, featureState, canonical, availableImages);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (type.kind === 'color') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    value = [value.r, value.g, value.b, value.a];
                }
                evaluationResult.push(value);
            } catch (error: any) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (error.name === 'ExpressionEvaluationError') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    evaluationResult.push({error: error.toJSON()});
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    evaluationResult.push({error: error.message});
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (fixture.inputs) {
            return evaluationResult;
        }
    };

    const result = {compiled: {}, recompiled: {}} as {compiled: any, recompiled: any, outputs: unknown, serialized: unknown, roundTripOutputs: unknown};
    const expression = (() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (isFunction(fixture.expression)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            return createPropertyExpression(convertFunction(fixture.expression, spec), spec);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            return createPropertyExpression(fixture.expression, spec);
        }
    })();

    result.outputs = evaluateExpression(expression, result.compiled);
    if (expression.result === 'success') {
        // @ts-expect-error - Property '_styleExpression' does not exist on type 'StylePropertyExpression'.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        result.serialized = expression.value._styleExpression.expression.serialize();
        result.roundTripOutputs = evaluateExpression(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            createPropertyExpression(result.serialized, spec),
            result.recompiled);
        // Type is allowed to change through serialization
        // (eg "array" -> "array<number, 3>")
        // Override the round-tripped type here so that the equality check passes
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        result.recompiled.type = result.compiled.type;
    }

    // Narrow down result to JSON
    return JSON.parse(JSON.stringify(result));
});
