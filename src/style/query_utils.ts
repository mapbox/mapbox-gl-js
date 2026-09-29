import Point from '@mapbox/point-geometry';

import type {PossiblyEvaluatedPropertyValue} from './properties';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';

export function getMaximumPaintValue(
    property: string,
    layer: TypedStyleLayer,
    dataDrivenValues: {getMaxValue: (property: string) => number},
): number {

    const value = ((layer.paint as {get: (prop: string) => PossiblyEvaluatedPropertyValue<number>}).get(property)).value;
    return value.kind === 'constant' ? value.value : dataDrivenValues.getMaxValue(property);
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

    const translated: Point[] = [];
    for (let i = 0; i < queryGeometry.length; i++) {
        const point = queryGeometry[i];
        translated.push(point.sub(pt));
    }
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
