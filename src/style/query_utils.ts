import Point from '@mapbox/point-geometry';

import type {PossiblyEvaluatedPropertyValue} from './properties';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type CircleBucket from '../data/bucket/circle_bucket';
import type LineBucket from '../data/bucket/line_bucket';

export function getMaximumPaintValue(
    property: string,
    layer: TypedStyleLayer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bucket: CircleBucket<any> | LineBucket,
): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = ((layer.paint as any).get(property) as PossiblyEvaluatedPropertyValue<any>).value;
    if (value.kind === 'constant') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value.value;
    } else {
        return bucket.programConfigurations.get(layer.id).getMaxValue(property);
    }
}

export function translateDistance(translate: [number, number]): number {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

export function translate(
    queryGeometry: Array<Point>,
    translate: [number, number],
    translateAnchor: 'viewport' | 'map',
    bearing: number,
    pixelsToTileUnits: number,
): Array<Point> {
    if (!translate[0] && !translate[1]) {
        return queryGeometry;
    }
    const pt = Point.convert(translate)._mult(pixelsToTileUnits);

    if (translateAnchor === "viewport") {
        pt._rotate(-bearing);
    }

    const translated = [];
    for (let i = 0; i < queryGeometry.length; i++) {
        const point = queryGeometry[i];
        translated.push(point.sub(pt));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return translated;
}

export function tilespaceTranslate(
    translate: [number, number],
    translateAnchor: 'viewport' | 'map',
    bearing: number,
    pixelsToTileUnits: number,
): Point {
    const pt = Point.convert(translate)._mult(pixelsToTileUnits);

    if (translateAnchor === "viewport") {
        pt._rotate(-bearing);
    }

    return pt;
}
