import Point from '@mapbox/point-geometry';
import StyleLayer from '../style_layer';
import LineBucket from '../../data/bucket/line_bucket';
import {polygonIntersectsBufferedMultiLine} from '../../util/intersection_tests';
import {getMaximumPaintValue, translateDistance, translate} from '../query_utils';
import {getLayoutProperties, getPaintProperties} from './line_style_layer_properties';
import {extend} from '../../util/util';
import EvaluationParameters from '../evaluation_parameters';
import {PossiblyEvaluated, DataDrivenProperty} from '../properties';
import ProgramConfiguration from '../../data/program_configuration';
import Step from '../../style-spec/expression/definitions/step';
import {lineDefinesValues} from '../../render/program/line_program';

import type {PossiblyEvaluatedValue, PropertyValue, PossiblyEvaluatedPropertyValue, ConfigOptions, Properties, Transitionable, Transitioning, Layout} from '../properties';
import type {Feature, FeatureState, ZoomConstantExpression, StylePropertyExpression} from '../../style-spec/expression/index';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './line_style_layer_properties';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';
import type {TilespaceQueryGeometry} from '../query_geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from '../../render/painter';
import type {DynamicDefinesType} from '../../render/program/program_uniforms';
import type SourceCache from '../../source/source_cache';
import type {LUT} from "../../util/lut";
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type {ProgramName} from '../../render/program';

let properties: {
    layout: Properties<LayoutProps>;
    paint: Properties<PaintProps>;
};

const getProperties = () => {
    if (properties) {
        return properties;
    }

    properties = {
        layout: getLayoutProperties(),
        paint: getPaintProperties()
    };

    return properties;
};

class LineFloorwidthProperty extends DataDrivenProperty<number> {
    override useIntegerZoom: boolean | null | undefined;

    override possiblyEvaluate(
        value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>,
        parameters: EvaluationParameters,
    ): PossiblyEvaluatedPropertyValue<number> {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            transition: parameters.transition,
            worldview: parameters.worldview
        });
        return super.possiblyEvaluate(value, parameters);
    }

    override evaluate(
        value: PossiblyEvaluatedValue<number>,
        globals: EvaluationParameters,
        feature: Feature,
        featureState: FeatureState,
    ): number {
        globals = extend({}, globals, {zoom: Math.floor(globals.zoom)});
        return super.evaluate(value, globals, feature, featureState);
    }
}

let lineFloorwidthProperty: LineFloorwidthProperty;
const getLineFloorwidthProperty = () => {
    if (lineFloorwidthProperty) {
        return lineFloorwidthProperty;
    }

    const properties = getProperties();

    lineFloorwidthProperty = new LineFloorwidthProperty(properties.paint.properties['line-width'].specification);
    lineFloorwidthProperty.useIntegerZoom = true;

    return lineFloorwidthProperty;
};

class LineStyleLayer extends StyleLayer {
    override type: 'line';

    override _unevaluatedLayout: Layout<LayoutProps>;
    override layout: PossiblyEvaluated<LayoutProps>;

    gradientVersion: number;
    stepInterpolant: boolean;

    hasElevatedBuckets: boolean;
    hasNonElevatedBuckets: boolean;

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = getProperties();
        super(layer, properties, scope, lut, options);
        if (properties.layout) {
            this.layout = new PossiblyEvaluated(properties.layout);
        }
        this.gradientVersion = 0;
        this.hasElevatedBuckets = false;
        this.hasNonElevatedBuckets = false;
    }

    override _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'line-gradient') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    override recalculate(parameters: EvaluationParameters, availableImages: ImageId[]) {
        super.recalculate(parameters, availableImages);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.paint._values as any)['line-floorwidth'] = getLineFloorwidthProperty().possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }

    createBucket(parameters: BucketParameters<LineStyleLayer>): LineBucket {
        return new LineBucket(parameters);
    }

    override getProgramIds(): ProgramName[] {
        const patternProperty = this.paint.get('line-pattern');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const image = patternProperty.constantOr((1 as any));
        const programId = image ? 'linePattern' : 'line';
        return [programId];
    }

    override getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        const definesValues = (lineDefinesValues(this) as DynamicDefinesType[]);
        return {
            config: new ProgramConfiguration(this, {zoom, lut}),
            defines: definesValues,
            overrideFog: false
        };
    }

    override queryRadius(bucket: Bucket): number {
        const lineBucket = bucket as LineBucket;
        const width = getLineWidth(
            getMaximumPaintValue('line-width', this, lineBucket),
            getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);

        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }

    override queryIntersectsFeature(
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
            this.paint.get('line-width').evaluate(feature, featureState),
            this.paint.get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * queryGeometry.pixelToTileUnitsFactor);
        }

        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }

    override isTileClipped(): boolean {
        return this.hasNonElevatedBuckets;
    }

    override isDraped(_?: SourceCache | null): boolean {
        return !this.hasElevatedBuckets || (this.layout && this.layout.get('line-elevation-reference') === 'hd-road-markup');
    }

    override hasElevation(): boolean {
        return this.layout && this.layout.get('line-elevation-reference') !== 'none';
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return newRings;
}
