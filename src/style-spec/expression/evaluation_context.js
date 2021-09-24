// @flow

import {Color} from './values.js';

import type Point from '@mapbox/point-geometry';
import type {FormattedSection} from './types/formatted.js';
import type {GlobalProperties, Feature, FeatureState} from './index.js';
import type {CanonicalTileID} from '../../source/tile_id.js';

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

class EvaluationContext {
    globals: GlobalProperties;
    feature: ?Feature;
    featureState: ?FeatureState;
    formattedSection: ?FormattedSection;
    availableImages: ?Array<string>;
    canonical: ?CanonicalTileID;
    featureTileCoord: ?Point;
    featureDistanceMatrix: ?number[];

    _parseColorCache: {[_: string]: ?Color};

    constructor() {
        this.globals = (null: any);
        this.feature = null;
        this.featureState = null;
        this.formattedSection = null;
        this._parseColorCache = {};
        this.availableImages = null;
        this.canonical = null;
        this.featureTileCoord = null;
        this.featureDistanceMatrix = null;
    }

    id() {
        return this.feature && 'id' in this.feature ? this.feature.id : null;
    }

    geometryType() {
        return this.feature ? typeof this.feature.type === 'number' ? geometryTypes[this.feature.type] : this.feature.type : null;
    }

    geometry() {
        return this.feature && 'geometry' in this.feature ? this.feature.geometry : null;
    }

    canonicalID() {
        return this.canonical;
    }

    properties() {
        return this.feature && this.feature.properties || {};
    }

    distanceFromCamera() {
        if (this.featureTileCoord && this.featureDistanceMatrix) {

            const m = this.featureDistanceMatrix;
            const {x, y} = this.featureTileCoord;
            const z = 0;

            //inlined vec3*mat4 multiplication to prevent importing gl-matrix as a dependency
            let w = m[3] * x + m[7] * y + m[11] * z + m[15];
            w = w || 1.0;
            const x1 = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
            const y1 = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
            const z1 = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;

            return Math.sqrt(x1 * x1 + y1 * y1  + z1 * z1);
        }

        return 0;
    }

    parseColor(input: string): ?Color {
        let cached = this._parseColorCache[input];
        if (!cached) {
            cached = this._parseColorCache[input] = Color.parse(input);
        }
        return cached;
    }
}

export default EvaluationContext;
