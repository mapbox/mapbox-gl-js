import assert from "assert";
import {VectorTileFeature, type VectorTileLayer} from "@mapbox/vector-tile";
import {warnOnce} from "../../src/util/util";
import {vec2} from "gl-matrix";
import {PROPERTY_ELEVATION_ID} from "./elevation_constants";
import {computeBounds, type Bounds} from "../../src/style-spec/util/geometry_util";

import type Point from "@mapbox/point-geometry";

export interface Vertex {
    id: number;
    idx: number;
    position: vec2;
    height: number;
    extent: number;
}
export interface Feature {
    id: number;
    bounds: Bounds;
    constantHeight: number | undefined;
}

export interface Result {
    vertices: Vertex[];
    features: Feature[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Convert = (value: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Setter = (value: any) => void;

class PropertyParser {
    feature: VectorTileFeature;
    private _geometry: Point[][];
    private _valid = false;

    reset(feature: VectorTileFeature): PropertyParser {
        this.feature = feature;
        this._valid = true;

        // Geometry is required to exist
        this._geometry = feature.loadGeometry();
        if (this._geometry.length === 0 || this._geometry[0].length === 0) {
            this._valid = false;
        }

        return this;
    }

    geometry(setter: Setter, convert: Convert) {
        if (this._valid) {
            setter(convert(this._geometry));
        }

        return this;
    }

    require(name: string, setter: Setter, convert?: Convert): PropertyParser {
        return this.get(name, true, setter, convert);
    }

    optional(name: string, setter: Setter, convert?: Convert): PropertyParser {
        return this.get(name, false, setter, convert);
    }

    success(): boolean {
        return this._valid;
    }

    private get(name: string, required, setter: Setter, convert?: Convert): PropertyParser {
        const value = this.feature.properties.hasOwnProperty(name) ? +this.feature.properties[name] : undefined;
        if (this._valid && value !== undefined && !Number.isNaN(value)) {
            if (convert) {
                setter(convert(value));
            } else {
                setter(value);
            }
        } else if (required) {
            this._valid = false;
        }
        return this;
    }
}

type FeatureFunc = (parser: PropertyParser, feature: VectorTileFeature, out: Feature) => boolean;
type VertexFunc = (parser: PropertyParser, feature: VectorTileFeature, out: Vertex) => boolean;

class VersionSchema {
    featureFunc: FeatureFunc;
    vertexFunc: VertexFunc;

    constructor(feature: FeatureFunc, vertex: VertexFunc) {
        this.featureFunc = feature;
        this.vertexFunc = vertex;
    }

    parseFeature(parser: PropertyParser, feature: VectorTileFeature, out: Feature): boolean {
        assert(this.featureFunc);
        return this.featureFunc(parser, feature, out);
    }

    parseVertex(parser: PropertyParser, feature: VectorTileFeature, out: Vertex): boolean {
        assert(this.vertexFunc);
        return this.vertexFunc(parser, feature, out);
    }
}

// Version parser definitions

// v1.0.0 (default)
const schemaV100 = new VersionSchema(
    (parser: PropertyParser, feature: VectorTileFeature, out: Feature) => {
        return parser.reset(feature)
            .require(PROPERTY_ELEVATION_ID, value => { out.id = value; })
            .optional('fixed_height_relative', value => { out.constantHeight = value; }, ElevationFeatureParser.decodeRelativeHeight)
            .geometry(value => { out.bounds = value; }, computeBounds)
            .success();
    },
    (parser: PropertyParser, feature: VectorTileFeature, out: Vertex) => {
        return parser.reset(feature)
            .require(PROPERTY_ELEVATION_ID, value => { out.id = value; })
            .require('elevation_idx', value => { out.idx = value; })
            .require('extent', value => { out.extent = value; })
            .require("height_relative", value => { out.height = value; }, ElevationFeatureParser.decodeRelativeHeight)
            .geometry(value => { out.position = value; }, ElevationFeatureParser.getPoint)
            .success();
    }
);

// v1.0.1
// Changes
//  - all height values in meters
//  - remove "relative" from property names
const schemaV101 = new VersionSchema(
    (parser: PropertyParser, feature: VectorTileFeature, out: Feature) => {
        return parser.reset(feature)
            .require(PROPERTY_ELEVATION_ID, value => { out.id = value; })
            .optional('fixed_height', value => { out.constantHeight = value; }, ElevationFeatureParser.decodeMetricHeight)
            .geometry(value => { out.bounds = value; }, computeBounds)
            .success();
    },
    (parser: PropertyParser, feature: VectorTileFeature, out: Vertex) => {
        return parser.reset(feature)
            .require(PROPERTY_ELEVATION_ID, value => { out.id = value; })
            .require('elevation_idx', value => { out.idx = value; })
            .require('extent', value => { out.extent = value; })
            .require("height", value => { out.height = value; }, ElevationFeatureParser.decodeMetricHeight)
            .geometry(value => { out.position = value; }, ElevationFeatureParser.getPoint)
            .success();
    }
);

export abstract class ElevationFeatureParser {
    static getPoint(points: Point[][]): vec2 {
        return vec2.fromValues(points[0][0].x, points[0][0].y);
    }

    static decodeRelativeHeight(height: number) {
        // Placeholder value for converting relative height values into meters.
        // Chosen purely based on visual inspection and all values are expected to be in
        // meters in future iterations
        const RELATIVE_ELEVATION_TO_METERS = 5.0;
        const scaler = 1.0 / 10000.0;
        return (height * scaler) * RELATIVE_ELEVATION_TO_METERS;
    }

    static decodeMetricHeight(height: number) {
        const scaler = 1.0 / 10000.0;
        return height * scaler;
    }

    static getVersionSchema(version: unknown) {
        if (!version) {
            return schemaV100;
        }

        if (version === '1.0.1') {
            return schemaV101;
        }

        return undefined;
    };

    static parse(data: VectorTileLayer): Result {
        const vertices: Vertex[] = [];
        const features: Feature[] = [];

        // All elevation features should have a "meta" feature describing their common properties.
        // In case of varying elevation, the feature might have a collection of individual points that together forms
        // one or more continuous "elevation curves".
        const featureCount = data.length;

        const parser = new PropertyParser();

        for (let index = 0; index < featureCount; index++) {
            const feature = data.feature(index);

            const version = feature.properties.version;

            // Get correct schema for the version. undefined == no version defined -> use default schema
            const schema = ElevationFeatureParser.getVersionSchema(version);
            if (schema === undefined) {
                warnOnce(`Unknown elevation feature version number ${version || '(unknown)'}`);
                continue;
            }

            const type = feature.properties['type'];
            if (!type) {
                continue;
            }

            const featureType = VectorTileFeature.types[feature.type];

            // Expect to find only "curve_meta" and "curve_point" features
            if (featureType === 'Point' && type === 'curve_point') {
                const out = {} as Vertex;

                if (schema.parseVertex(parser, feature, out)) {
                    vertices.push(out);
                }
            } else if (featureType === 'Polygon' && type === 'curve_meta') {
                const out = {} as Feature;

                if (schema.parseFeature(parser, feature, out)) {
                    features.push(out);
                }
            }
        }

        return {vertices, features};
    }
}
