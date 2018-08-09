// @flow

import Point from '@mapbox/point-geometry';

import type {PossiblyEvaluatedPropertyValue} from "./properties";
import type StyleLayer from '../style/style_layer';
import type CircleBucket from '../data/bucket/circle_bucket';
import type LineBucket from '../data/bucket/line_bucket';

export function getMaximumPaintValue(property: string, layer: StyleLayer, bucket: CircleBucket<*> | LineBucket): number {
    const value = ((layer.paint: any).get(property): PossiblyEvaluatedPropertyValue<any>).value;
    if (value.kind === 'constant') {
        return value.value;
    } else {
        const binders = bucket.programConfigurations.get(layer.id).binders;
        return binders[property].statistics.max;
    }
}

export function translateDistance(translate: [number, number]) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

export function translate(queryGeometry: Array<Array<Point>>,
                   translate: [number, number],
                   translateAnchor: 'viewport' | 'map',
                   bearing: number,
                   pixelsToTileUnits: number) {
    let [dx, dy] = translate;
    if (!dx && !dy) {
        return queryGeometry;
    }

    if (translateAnchor === "viewport") {
        const sin = Math.sin(-bearing);
        const cos = Math.cos(-bearing);
        const tmp = cos * dx - sin * dy;
        dy = sin * dx + cos * dy;
        dx = tmp;
    }

    const translated = [];
    for (let i = 0; i < queryGeometry.length; i++) {
        const translatedRing = [];
        for (const p of queryGeometry[i]) {
            translatedRing.push(new Point(
                p.x - dx * pixelsToTileUnits,
                p.y - dy * pixelsToTileUnits));
        }
        translated.push(translatedRing);
    }
    return translated;
}
