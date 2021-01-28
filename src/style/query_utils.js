// @flow

import Point from '@mapbox/point-geometry';

import type {PossiblyEvaluatedPropertyValue} from './properties.js';
import type StyleLayer from '../style/style_layer.js';
import type CircleBucket from '../data/bucket/circle_bucket.js';
import type LineBucket from '../data/bucket/line_bucket.js';

export function getMaximumPaintValue(property: string, layer: StyleLayer, bucket: CircleBucket<*> | LineBucket): number {
    const value = ((layer.paint: any).get(property): PossiblyEvaluatedPropertyValue<any>).value;
    if (value.kind === 'constant') {
        return value.value;
    } else {
        return bucket.programConfigurations.get(layer.id).getMaxValue(property);
    }
}

export function translateDistance(translate: [number, number]) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

export function translate(queryGeometry: Array<Point>,
                   translate: [number, number],
                   translateAnchor: 'viewport' | 'map',
                   bearing: number,
                   pixelsToTileUnits: number) {
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
    return translated;
}

export function tilespaceTranslate(translate: [number, number],
                    translateAnchor: 'viewport' | 'map',
                    bearing: number,
                    pixelsToTileUnits: number): Point {
    const pt = Point.convert(translate)._mult(pixelsToTileUnits);

    if (translateAnchor === "viewport") {
        pt._rotate(-bearing);
    }

    return pt;
}
