// eslint-disable-next-line import-x/extensions
import {run} from './integration/lib/expression';
import {createConfigExpression, createPropertyExpression} from '../src/style-spec/expression/index';
import {isFunction} from '../src/style-spec/function/index';
import convertFunction from '../src/style-spec/function/convert';
import {toString} from '../src/style-spec/expression/types';
import {CanonicalTileID} from '../src/source/tile_id';
import MercatorCoordinate from '../src/geo/mercator_coordinate';
import tileTransform, {getTilePoint} from '../src/geo/projection/tile_transform';
import {getProjection} from '../src/geo/projection/index';
import {fileURLToPath} from 'url';

import type Point from '@mapbox/point-geometry';
import type {StylePropertySpecification} from '../src/style-spec/style-spec';
import type {FunctionSpecification} from '../src/style-spec/types';
import type ParsingError from '../src/style-spec/expression/parsing_error';
import type {CompilationResult} from './integration/lib/expression';
import type {Result} from '../src/style-spec/util/result';
import type {Feature, GlobalProperties, StylePropertyExpression, ZoomConstantExpression, ZoomDependentExpression} from '../src/style-spec/expression/index';
import type {EvaluationKind} from '../src/style-spec/expression/types';

// The feature passed to the evaluator: its `type` is the (possibly collapsed) geometry type and
// its `geometry` is in tile coordinates, so it isn't a GeoJSON.Feature.
type ExpressionTestFeature = {
    type?: string;
    id?: string | number;
    properties: Record<string, unknown>;
    geometry?: Point[][];
};

const __filename = fileURLToPath(import.meta.url);
const projection = getProjection({name: 'mercator'});

// @ts-expect-error - DOMMatrix is not defined in Node.js
global.DOMMatrix = class {};

function getPoint(coord: GeoJSON.Position, canonical: CanonicalTileID): Point {
    const tileTr = tileTransform(canonical, projection);
    const p = getTilePoint(tileTr, MercatorCoordinate.fromLngLat({lng: coord[0], lat: coord[1]}, 0));
    // Quantize to integer tile units the way GL Native's Projection::latLonToTileCoordinates
    // does, so these fixtures produce identical expectations in both runners.
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    return p;
}

function convertPoint(coord: GeoJSON.Position, canonical: CanonicalTileID, out: Point[][]) {
    out.push([getPoint(coord, canonical)]);
}

function convertPoints(coords: GeoJSON.Position[], canonical: CanonicalTileID, out: Point[][]) {
    for (let i = 0; i < coords.length; i++) {
        convertPoint(coords[i], canonical, out);
    }
}

function convertLine(line: GeoJSON.Position[], canonical: CanonicalTileID, out: Point[][]) {
    const l: Point[] = [];
    for (let i = 0; i < line.length; i++) {
        l.push(getPoint(line[i], canonical));
    }
    out.push(l);
}

function convertLines(lines: GeoJSON.Position[][], canonical: CanonicalTileID, out: Point[][]) {
    for (let i = 0; i < lines.length; i++) {
        convertLine(lines[i], canonical, out);
    }
}

function getGeometry(feature: ExpressionTestFeature, geometry: {type: string; coordinates?: unknown}, canonical: CanonicalTileID) {
    if (geometry.coordinates) {
        const coords = geometry.coordinates;
        const type = geometry.type;
        feature.type = type;
        feature.geometry = [];
        if (type === 'Point') {
            convertPoint(coords as GeoJSON.Position, canonical, feature.geometry);
        } else if (type === 'MultiPoint') {
            feature.type = 'Point';
            convertPoints(coords as GeoJSON.Position[], canonical, feature.geometry);
        } else if (type === 'LineString') {
            convertLine(coords as GeoJSON.Position[], canonical, feature.geometry);
        } else if (type === 'MultiLineString') {
            feature.type = 'LineString';
            convertLines(coords as GeoJSON.Position[][], canonical, feature.geometry);
        } else if (type === 'Polygon') {
            convertLines(coords as GeoJSON.Position[][], canonical, feature.geometry);
        } else if (type === 'MultiPolygon') {
            feature.type = 'Polygon';
            for (let i = 0; i < (coords as GeoJSON.Position[][][]).length; i++) {
                convertLines((coords as GeoJSON.Position[][][])[i], canonical, feature.geometry);
            }
        }
    }
}

let tests: any;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
run('js', {tests}, (fixture) => {
    const spec = {...fixture.propertySpec} as StylePropertySpecification;
    let availableImages: any;
    let canonical: CanonicalTileID | null;

    if (!spec['property-type']) {
        spec['property-type'] = 'data-driven';
    }

    if (!spec['expression']) {
        spec['expression'] = {
            'interpolated': true,
            'parameters': ['zoom', 'feature']
        };
    }

    const evaluateExpression = (parseResult: Result<StylePropertyExpression, ParsingError[]>, compilationResult: CompilationResult) => {
        if (parseResult.result === 'error') {
            compilationResult.result = 'error';
            compilationResult.errors = parseResult.value.map((err: ParsingError) => ({
                key: err.key,
                error: err.message
            }));
            return;
        }

        const evaluationResult: Array<any> = [];

        const expression = parseResult.value as ZoomConstantExpression<EvaluationKind> | ZoomDependentExpression<EvaluationKind>;
        const type = expression._styleExpression.expression.type; // :scream:

        compilationResult.result = 'success';
        compilationResult.isFeatureConstant = expression.kind === 'constant' || expression.kind === 'camera';
        compilationResult.isZoomConstant = expression.kind === 'constant' || expression.kind === 'source';
        compilationResult.type = toString(type);

        for (const input of fixture.inputs || []) {
            try {
                const feature = {properties: input[1].properties || {}} as ExpressionTestFeature;

                const featureState = input[2] || {};

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

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
                let value = expression.evaluateWithoutErrorHandling(input[0] as GlobalProperties, feature as Feature, featureState, canonical, availableImages);

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

        if (fixture.inputs) {
            return evaluationResult;
        }
    };

    // Fixtures may exercise a `["config", ...]` argument by putting a `config`
    // object on an input's globals, e.g. `inputs[i][0].config = {key: value}`
    // (mirrors gl-native's expression-test `config` input, added alongside
    // this same fixture format). Build a ConfigOptions map from it -- keyed
    // by the bare option id since these fixtures use no scope -- so
    // `["config", "key"]` resolves via EvaluationContext#getConfig.
    let configOptions: any;
    for (const input of fixture.inputs || []) {
        const config = input[0] && input[0].config;
        if (!config) continue;
        configOptions = new Map();
        for (const key of Object.keys(config)) {
            const value = config[key];
            const defaultExpression = createConfigExpression(value);
            if (defaultExpression.result === 'success') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                configOptions.set(key, {default: defaultExpression.value.expression});
            }
        }
        break;
    }

    const result = {compiled: {}, recompiled: {}} as {compiled: CompilationResult, recompiled: CompilationResult, outputs: unknown, serialized: unknown, roundTripOutputs: unknown};
    const expression = (() => {
        if (isFunction(fixture.expression)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return createPropertyExpression(convertFunction(fixture.expression as FunctionSpecification<unknown>, spec), spec, null, configOptions);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return createPropertyExpression(fixture.expression, spec, null, configOptions);
        }
    })();

    result.outputs = evaluateExpression(expression, result.compiled);
    if (expression.result === 'success') {
        // @ts-expect-error - Property '_styleExpression' does not exist on type 'StylePropertyExpression'.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        result.serialized = expression.value._styleExpression.expression.serialize();
        result.roundTripOutputs = evaluateExpression(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            createPropertyExpression(result.serialized, spec, null, configOptions),
            result.recompiled);
        // Type is allowed to change through serialization
        // (eg "array" -> "array<number, 3>")
        // Override the round-tripped type here so that the equality check passes
        result.recompiled.type = result.compiled.type;
    }

    // Narrow down result to JSON
    return JSON.parse(JSON.stringify(result));
});
