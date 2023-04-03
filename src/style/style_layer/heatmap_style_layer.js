// @flow

import StyleLayer from '../style_layer.js';

import HeatmapBucket from '../../data/bucket/heatmap_bucket.js';
import {RGBAImage} from '../../util/image.js';
import properties from './heatmap_style_layer_properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';
import {queryIntersectsCircle} from './circle_style_layer.js';
import {getMaximumPaintValue} from '../query_utils.js';
import Point from '@mapbox/point-geometry';

import type {Bucket, BucketParameters} from '../../data/bucket.js';
import type Texture from '../../render/texture.js';
import type Framebuffer from '../../gl/framebuffer.js';
import type {PaintProps} from './heatmap_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import ProgramConfiguration from '../../data/program_configuration.js';
import type {TilespaceQueryGeometry} from '../query_geometry.js';
import type {DEMSampler} from '../../terrain/elevation.js';
import type {FeatureState} from '../../style-spec/expression/index.js';
import type Transform from '../../geo/transform.js';
import type CircleBucket from '../../data/bucket/circle_bucket.js';
import type {IVectorTileFeature} from '@mapbox/vector-tile';

class HeatmapStyleLayer extends StyleLayer {

    heatmapFbo: ?Framebuffer;
    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    createBucket(parameters: BucketParameters<HeatmapStyleLayer>): HeatmapBucket {
        return new HeatmapBucket(parameters);
    }

    constructor(layer: LayerSpecification) {
        super(layer, properties);

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

    // $FlowFixMe[method-unbinding]
    queryRadius(bucket: Bucket): number {
        return getMaximumPaintValue('heatmap-radius', this, ((bucket: any): CircleBucket<*>));
    }

    // $FlowFixMe[method-unbinding]
    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: IVectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelPosMatrix: Float32Array,
                           elevationHelper: ?DEMSampler): boolean {

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

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }
}

export default HeatmapStyleLayer;
