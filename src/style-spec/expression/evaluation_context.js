// @flow

import {Color} from './values.js';
import {vec3} from 'gl-matrix';

import type MercatorCoordinate from '../../geo/mercator_coordinate.js';
import type {FormattedSection} from './types/formatted.js';
import type {GlobalProperties, Feature, FeatureState} from './index.js';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

const tempArray = [0, 0, 0];

class EvaluationContext {
    globals: GlobalProperties;
    feature: ?Feature;
    featureState: ?FeatureState;
    formattedSection: ?FormattedSection;
    availableImages: ?Array<string>;
    canonical: ?CanonicalTileID;
    cameraDistanceReferencePoint: ?MercatorCoordinate;

    _parseColorCache: {[_: string]: ?Color};

    constructor() {
        this.globals = (null: any);
        this.feature = null;
        this.featureState = null;
        this.formattedSection = null;
        this._parseColorCache = {};
        this.availableImages = null;
        this.canonical = null;
        this.cameraDistanceReferencePoint = null;
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
        if (this.cameraDistanceReferencePoint && this.globals && this.globals.cameraDistanceMatrix) {
            tempArray[0] = this.cameraDistanceReferencePoint.x;
            tempArray[1] = this.cameraDistanceReferencePoint.y;
            tempArray[2] = this.cameraDistanceReferencePoint.z;
            return vec3.length(vec3.transformMat4(tempArray, tempArray, this.globals.cameraDistanceMatrix));
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
