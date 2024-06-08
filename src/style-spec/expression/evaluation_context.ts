import {Color} from './values';

import type Point from '@mapbox/point-geometry';
import type {FormattedSection} from './types/formatted';
import type {GlobalProperties, Feature, FeatureState} from './index';
import type {CanonicalTileID} from '../types/tile_id';
import type {FeatureDistanceData} from '../feature_filter/index';
import type {ConfigOptions, ConfigOptionValue} from '../types/config_options';

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

class EvaluationContext {
    globals: GlobalProperties;
    feature: Feature | null | undefined;
    featureState: FeatureState | null | undefined;
    formattedSection: FormattedSection | null | undefined;
    availableImages: Array<string> | null | undefined;
    canonical: null | CanonicalTileID;
    featureTileCoord: Point | null | undefined;
    featureDistanceData: FeatureDistanceData | null | undefined;
    scope: string | null | undefined;
    options: ConfigOptions | null | undefined;

    _parseColorCache: {
        [_: string]: Color | null | undefined;
    };

    constructor(scope?: string | null, options?: ConfigOptions | null) {
        this.globals = (null as any);
        this.feature = null;
        this.featureState = null;
        this.formattedSection = null;
        this._parseColorCache = {};
        this.availableImages = null;
        this.canonical = null;
        this.featureTileCoord = null;
        this.featureDistanceData = null;
        this.scope = scope;
        this.options = options;
    }

    id(): number | null {
        return this.feature && this.feature.id !== undefined ? this.feature.id : null;
    }

    geometryType(): null | string {
        return this.feature ? typeof this.feature.type === 'number' ? geometryTypes[this.feature.type] : this.feature.type : null;
    }

    geometry(): Array<Array<Point>> | null | undefined {
        return this.feature && 'geometry' in this.feature ? this.feature.geometry : null;
    }

    canonicalID(): null | CanonicalTileID {
        return this.canonical;
    }

    properties(): {
        [key: string]: any;
        } {
        return (this.feature && this.feature.properties) || {};
    }

    measureLight(_: string): number {
        return this.globals.brightness || 0;
    }

    distanceFromCenter(): number {
        if (this.featureTileCoord && this.featureDistanceData) {

            const c = this.featureDistanceData.center;
            const scale = this.featureDistanceData.scale;
            const {x, y} = this.featureTileCoord;

            // Calculate the distance vector `d` (left handed)
            const dX = x * scale - c[0];
            const dY = y * scale - c[1];

            // The bearing vector `b` (left handed)
            const bX = this.featureDistanceData.bearing[0];
            const bY = this.featureDistanceData.bearing[1];

            // Distance is calculated as `dot(d, v)`
            const dist = (bX * dX + bY * dY);
            return dist;
        }

        return 0;
    }

    parseColor(input: string): Color | null | undefined {
        let cached = this._parseColorCache[input];
        if (!cached) {
            // @ts-expect-error - TS2322 - Type 'void | Color' is not assignable to type 'Color'. | TS2322 - Type 'void | Color' is not assignable to type 'Color'.
            cached = this._parseColorCache[input] = Color.parse(input);
        }
        return cached;
    }

    getConfig(id: string): ConfigOptionValue | null | undefined {
        return this.options ? this.options.get(id) : null;
    }
}

export default EvaluationContext;
