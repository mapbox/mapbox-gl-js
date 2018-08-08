// @flow

import Point from '@mapbox/point-geometry';

import StyleLayer from '../style_layer';
import LineBucket from '../../data/bucket/line_bucket';
import { RGBAImage } from '../../util/image';
import { multiPolygonIntersectsBufferedMultiLine } from '../../util/intersection_tests';
import { getMaximumPaintValue, translateDistance, translate } from '../query_utils';
import properties from './line_style_layer_properties';
import { extend, hypot } from '../../util/util';
import EvaluationParameters from '../evaluation_parameters';
import renderColorRamp from '../../util/color_ramp';
import { Transitionable, Transitioning, Layout, PossiblyEvaluated, DataDrivenProperty } from '../properties';

import type { FeatureState } from '../../style-spec/expression';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './line_style_layer_properties';
import type Transform from '../../geo/transform';
import type Texture from '../../render/texture';
import type {LayerSpecification} from '../../style-spec/types';

class LineFloorwidthProperty extends DataDrivenProperty<number> {
    useIntegerZoom: true;

    possiblyEvaluate(value, parameters) {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            zoomHistory: parameters.zoomHistory,
            transition: parameters.transition
        });
        return super.possiblyEvaluate(value, parameters);
    }

    evaluate(value, globals, feature, featureState) {
        globals = extend({}, globals, {zoom: Math.floor(globals.zoom)});
        return super.evaluate(value, globals, feature, featureState);
    }
}

const lineFloorwidthProperty = new LineFloorwidthProperty(properties.paint.properties['line-width'].specification);
lineFloorwidthProperty.useIntegerZoom = true;

class LineStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    gradient: ?RGBAImage;
    gradientTexture: ?Texture;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'line-gradient') {
            this._updateGradient();
        }
    }

    _updateGradient() {
        const expression = this._transitionablePaint._values['line-gradient'].value.expression;
        this.gradient = renderColorRamp(expression, 'lineProgress');
        this.gradientTexture = null;
    }

    recalculate(parameters: EvaluationParameters) {
        super.recalculate(parameters);

        (this.paint._values: any)['line-floorwidth'] =
            lineFloorwidthProperty.possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }

    createBucket(parameters: BucketParameters<*>) {
        return new LineBucket(parameters);
    }

    queryRadius(bucket: Bucket): number {
        const lineBucket: LineBucket = (bucket: any);
        const width = getLineWidth(
            getMaximumPaintValue('line-width', this, lineBucket),
            getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);
        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('line-translate'),
            this.paint.get('line-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        const halfWidth = pixelsToTileUnits / 2 * getLineWidth(
            this.paint.get('line-width').evaluate(feature, featureState),
            this.paint.get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
        }
        return multiPolygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }
}

export default LineStyleLayer;

function getLineWidth(lineWidth, lineGapWidth) {
    if (lineGapWidth > 0) {
        return lineGapWidth + 2 * lineWidth;
    } else {
        return lineWidth;
    }
}

function offsetLine(rings, offset) {
    const newRings = [];
    for (const ring of rings) {
        const newRing = [];
        for (let i = 0; i < ring.length; i++) {
            const {x, y} = ring[i];

            const dx0 = i === 0 ? ring[i + 1].x - x : x - ring[i - 1].x;
            const dy0 = i === 0 ? ring[i + 1].y - y : y - ring[i - 1].y;
            const dx1 = i === ring.length - 1 ? dx0 : ring[i + 1].x - x;
            const dy1 = i === ring.length - 1 ? dy0 : ring[i + 1].y - y;

            const d0 = hypot(dx0, dy0);
            const d1 = hypot(dx1, dy1);
            const prevNormalX = -dy0 / d0;
            const prevNormalY = dx0 / d0;
            const nextNormalX = -dy1 / d1;
            const nextNormalY = dx1 / d1;

            const extrudeX = prevNormalX + nextNormalX;
            const extrudeY = prevNormalY + nextNormalY;
            const cosHalfAngle = extrudeX * nextNormalX + extrudeY * nextNormalY;

            newRing.push(new Point(
                x + extrudeX * offset / cosHalfAngle,
                y + extrudeY * offset / cosHalfAngle
            ));
        }
        newRings.push(newRing);
    }
    return newRings;
}
