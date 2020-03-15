// @flow

import {Color} from './values';
import type {FormattedSection} from './types/formatted';
import type {GlobalProperties, Feature, FeatureState} from './index';
import type {CanonicalTileID} from '../../source/tile_id';

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

class EvaluationContext {
    globals: GlobalProperties;
    feature: ?Feature;
    featureState: ?FeatureState;
    formattedSection: ?FormattedSection;
    availableImages: ?Array<string>;
    canonical: ?CanonicalTileID;

    _parseColorCache: {[_: string]: ?Color};

    constructor() {
        this.globals = (null: any);
        this.feature = null;
        this.featureState = null;
        this.formattedSection = null;
        this._parseColorCache = {};
        this.availableImages = null;
        this.canonical = null;
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

    parseColor(input: string): ?Color {
        let cached = this._parseColorCache[input];
        if (!cached) {
            cached = this._parseColorCache[input] = Color.parse(input);
        }
        return cached;
    }
}

export default EvaluationContext;
