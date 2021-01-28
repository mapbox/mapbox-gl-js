// @flow

import Point from '@mapbox/point-geometry';

import StyleLayer from '../style_layer.js';
import LineBucket from '../../data/bucket/line_bucket.js';
import {polygonIntersectsBufferedMultiLine} from '../../util/intersection_tests.js';
import {getMaximumPaintValue, translateDistance, translate} from '../query_utils.js';
import properties from './line_style_layer_properties.js';
import {extend, MAX_SAFE_INTEGER} from '../../util/util.js';
import EvaluationParameters from '../evaluation_parameters.js';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated, DataDrivenProperty} from '../properties.js';
import ProgramConfiguration from '../../data/program_configuration.js';

import Step from '../../style-spec/expression/definitions/step.js';
import type {FeatureState, ZoomConstantExpression} from '../../style-spec/expression/index.js';
import type {Bucket, BucketParameters} from '../../data/bucket.js';
import type {LayoutProps, PaintProps} from './line_style_layer_properties.js';
import type Transform from '../../geo/transform.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {TilespaceQueryGeometry} from '../query_geometry.js';

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

    gradientVersion: number;
    stepInterpolant: boolean;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this.gradientVersion = 0;
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'line-gradient') {
            const expression: ZoomConstantExpression<'source'> = ((this._transitionablePaint._values['line-gradient'].value.expression): any);
            this.stepInterpolant = expression._styleExpression.expression instanceof Step;
            this.gradientVersion = (this.gradientVersion + 1) % MAX_SAFE_INTEGER;
        }
    }

    gradientExpression() {
        return this._transitionablePaint._values['line-gradient'].value.expression;
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        (this.paint._values: any)['line-floorwidth'] =
            lineFloorwidthProperty.possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }

    createBucket(parameters: BucketParameters<*>) {
        return new LineBucket(parameters);
    }

    getProgramIds(): string[] {
        const dasharray = this.paint.get('line-dasharray');
        const patternProperty = this.paint.get('line-pattern');
        const image = patternProperty.constantOr((1: any));
        const gradient = this.paint.get('line-gradient');
        const programId =
            image ? 'linePattern' :
            dasharray ? 'lineSDF' :
            gradient ? 'lineGradient' : 'line';
        return [programId];
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }

    queryRadius(bucket: Bucket): number {
        const lineBucket: LineBucket = (bucket: any);
        const width = getLineWidth(
            getMaximumPaintValue('line-width', this, lineBucket),
            getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);
        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }

    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform): boolean {
        if (queryGeometry.queryGeometry.isAboveHorizon) return false;

        const translatedPolygon = translate(queryGeometry.tilespaceGeometry,
            this.paint.get('line-translate'),
            this.paint.get('line-translate-anchor'),
            transform.angle, queryGeometry.pixelToTileUnitsFactor);
        const halfWidth = queryGeometry.pixelToTileUnitsFactor / 2 * getLineWidth(
            this.paint.get('line-width').evaluate(feature, featureState),
            this.paint.get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * queryGeometry.pixelToTileUnitsFactor);
        }

        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }

    isTileClipped() {
        return true;
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
    const zero = new Point(0, 0);
    for (let k = 0; k < rings.length; k++) {
        const ring = rings[k];
        const newRing = [];
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i - 1];
            const b = ring[i];
            const c = ring[i + 1];
            const aToB = i === 0 ? zero : b.sub(a)._unit()._perp();
            const bToC = i === ring.length - 1 ? zero : c.sub(b)._unit()._perp();
            const extrude = aToB._add(bToC)._unit();

            const cosHalfAngle = extrude.x * bToC.x + extrude.y * bToC.y;
            extrude._mult(1 / cosHalfAngle);

            newRing.push(extrude._mult(offset)._add(b));
        }
        newRings.push(newRing);
    }
    return newRings;
}
