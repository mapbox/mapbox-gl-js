import StyleLayer from '../style_layer';

import HeatmapBucket from '../../data/bucket/heatmap_bucket';
import {RGBAImage} from '../../util/image';
import properties from './heatmap_style_layer_properties';
import {renderColorRamp} from '../../util/color_ramp';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';
import {queryIntersectsCircle} from './circle_style_layer';
import {getMaximumPaintValue} from '../query_utils';
import Point from '@mapbox/point-geometry';

import type {Bucket, BucketParameters} from '../../data/bucket';
import type Texture from '../../render/texture';
import type Framebuffer from '../../gl/framebuffer';
import type {PaintProps} from './heatmap_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import ProgramConfiguration from '../../data/program_configuration';
import type {TilespaceQueryGeometry} from '../query_geometry';
import type {DEMSampler} from '../../terrain/elevation';
import type {FeatureState} from '../../style-spec/expression/index';
import type Transform from '../../geo/transform';
import type CircleBucket from '../../data/bucket/circle_bucket';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from '../../render/painter';
import type {ConfigOptions} from '../properties';
import type {LUT} from "../../util/lut";

class HeatmapStyleLayer extends StyleLayer {

    heatmapFbo: Framebuffer | null | undefined;
    colorRamp: RGBAImage;
    colorRampTexture: Texture | null | undefined;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    createBucket(parameters: BucketParameters<HeatmapStyleLayer>): HeatmapBucket {
        return new HeatmapBucket(parameters);
    }

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, properties, scope, lut, options);

        // make sure color ramp texture is generated for default heatmap color too
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'heatmapDensity',
            image: this.colorRamp
        });
        this.colorRampTexture = null;
    }

    resize() {
        if (this.heatmapFbo) {
            this.heatmapFbo.destroy();
            this.heatmapFbo = null;
        }
    }

    queryRadius(bucket: Bucket): number {
        return getMaximumPaintValue('heatmap-radius', this, (bucket as CircleBucket<any>));
    }

    queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
        pixelPosMatrix: Float32Array,
        elevationHelper?: DEMSampler | null,
    ): boolean {

        // @ts-expect-error - TS2339 - Property 'evaluate' does not exist on type 'unknown'.
        const size = this.paint.get('heatmap-radius').evaluate(feature, featureState);
        return queryIntersectsCircle(
            queryGeometry, geometry, transform, pixelPosMatrix, elevationHelper,
            true, true, new Point(0, 0), size);
    }

    hasOffscreenPass(): boolean {
        return this.paint.get('heatmap-opacity') !== 0 && this.visibility !== 'none';
    }

    getProgramIds(): Array<string> {
        return ['heatmap', 'heatmapTexture'];
    }

    getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        if (name === 'heatmap') {
            return {
                config: new ProgramConfiguration(this, {zoom, lut}),
                overrideFog: false
            };
        }
        return {};
    }
}

export default HeatmapStyleLayer;
