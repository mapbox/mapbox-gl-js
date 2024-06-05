import Point from '@mapbox/point-geometry';

import StyleLayer from '../style_layer';
import LineBucket from '../../data/bucket/line_bucket';
import {polygonIntersectsBufferedMultiLine} from '../../util/intersection_tests';
import {getMaximumPaintValue, translateDistance, translate} from '../query_utils';
import properties from './line_style_layer_properties';
import {extend} from '../../util/util';
import EvaluationParameters from '../evaluation_parameters';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated, DataDrivenProperty} from '../properties';
import ProgramConfiguration from '../../data/program_configuration';

import Step from '../../style-spec/expression/definitions/step';
import type {PossiblyEvaluatedValue, PropertyValue, PossiblyEvaluatedPropertyValue, ConfigOptions} from '../properties';
import type {Feature, FeatureState, ZoomConstantExpression, StylePropertyExpression} from '../../style-spec/expression/index';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './line_style_layer_properties';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';
import type {TilespaceQueryGeometry} from '../query_geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import {lineDefinesValues} from '../../render/program/line_program';
import type {CreateProgramParams} from '../../render/painter';
import type {DynamicDefinesType} from '../../render/program/program_uniforms';
import SourceCache from '../../source/source_cache';
import type {LUT} from "../../util/lut";

class LineFloorwidthProperty extends DataDrivenProperty<number> {
    useIntegerZoom: boolean | null | undefined;

    possiblyEvaluate(
        value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>,
        parameters: EvaluationParameters,
    ): PossiblyEvaluatedPropertyValue<number> {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            transition: parameters.transition
        });
        return super.possiblyEvaluate(value, parameters);
    }

    evaluate(
        value: PossiblyEvaluatedValue<number>,
        globals: EvaluationParameters,
        feature: Feature,
        featureState: FeatureState,
    ): number {
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

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, properties, scope, lut, options);
        if (properties.layout) {
            this.layout = new PossiblyEvaluated(properties.layout);
        }
        this.gradientVersion = 0;
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'line-gradient') {
            const expression: ZoomConstantExpression<'source'> = ((this._transitionablePaint._values['line-gradient'].value.expression) as any);
            this.stepInterpolant = expression._styleExpression && expression._styleExpression.expression instanceof Step;
            this.gradientVersion = (this.gradientVersion + 1) % Number.MAX_SAFE_INTEGER;
        }
    }

    gradientExpression(): StylePropertyExpression {
        return this._transitionablePaint._values['line-gradient'].value.expression;
    }

    widthExpression(): StylePropertyExpression {
        return this._transitionablePaint._values['line-width'].value.expression;
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        (this.paint._values as any)['line-floorwidth'] =

            lineFloorwidthProperty.possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }

    createBucket(parameters: BucketParameters<LineStyleLayer>): LineBucket {
        return new LineBucket(parameters);
    }

    getProgramIds(): string[] {
        const patternProperty = this.paint.get('line-pattern');

        const image = patternProperty.constantOr((1 as any));
        const programId = image ? 'linePattern' : 'line';
        return [programId];
    }

    getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        const definesValues = (lineDefinesValues(this) as DynamicDefinesType[]);
        return {
            config: new ProgramConfiguration(this, {zoom, lut}),
            defines: definesValues,
            overrideFog: false
        };
    }

    queryRadius(bucket: Bucket): number {
        const lineBucket: LineBucket = (bucket as any);
        const width = getLineWidth(
            getMaximumPaintValue('line-width', this, lineBucket),
            getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);

        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }

    queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
    ): boolean {
        if (queryGeometry.queryGeometry.isAboveHorizon) return false;

        const translatedPolygon = translate(queryGeometry.tilespaceGeometry,

            this.paint.get('line-translate'),
            this.paint.get('line-translate-anchor'),
            transform.angle, queryGeometry.pixelToTileUnitsFactor);
        const halfWidth = queryGeometry.pixelToTileUnitsFactor / 2 * getLineWidth(
            // @ts-expect-error - TS2339 - Property 'evaluate' does not exist on type 'unknown'.
            this.paint.get('line-width').evaluate(feature, featureState),
            // @ts-expect-error - TS2339 - Property 'evaluate' does not exist on type 'unknown'.
            this.paint.get('line-gap-width').evaluate(feature, featureState));
        // @ts-expect-error - TS2339 - Property 'evaluate' does not exist on type 'unknown'.
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * queryGeometry.pixelToTileUnitsFactor);
        }

        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }

    isTileClipped(): boolean {
        return true;
    }

    isDraped(_?: SourceCache | null): boolean {
        const zOffset = this.layout.get('line-z-offset');

        return zOffset.isConstant() && !zOffset.constantOr(0);
    }
}

export default LineStyleLayer;

function getLineWidth(lineWidth: number, lineGapWidth: number) {
    if (lineGapWidth > 0) {
        return lineGapWidth + 2 * lineWidth;
    } else {
        return lineWidth;
    }
}

function offsetLine(rings: Array<Array<Point>>, offset: number) {
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
