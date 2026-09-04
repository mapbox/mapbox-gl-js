import EXTENT from '../style-spec/data/extent';
import {PbfWriter} from 'pbf';

import type {Feature} from './geojson_wrapper';

/**
 * Encodes a set of GeoJSON-like features as vector tiles.
 * @private
 */
export default function writeFeatures(layers: Record<string, readonly Feature[]>) {
    const pbf = new PbfWriter();
    for (const name of Object.keys(layers)) {
        const features = layers[name]!;
        pbf.writeMessage(3, writeLayer, {name, features});
    }
    return pbf.finish();
}

function writeLayer({name, features}: {name: string, features: readonly Feature[]}, pbf: PbfWriter) {
    pbf.writeStringField(1, name);
    pbf.writeVarintField(5, EXTENT);

    const keys = new Map<string, number>();
    const values = new Map<unknown, number>();

    const context: FeatureContext = {
        keys,
        values,
        feature: null
    };
    for (const feature of features) {
        context.feature = feature;
        pbf.writeMessage(2, writeFeature, context);
    }
    for (const key of keys.keys()) {
        pbf.writeStringField(3, key);
    }
    for (const value of values.keys()) {
        pbf.writeMessage(4, writeValue, value);
    }
}

type FeatureContext = {keys: Map<string, number>, values: Map<unknown, number>, feature: Feature | null};

function writeFeature(context: FeatureContext, pbf: PbfWriter) {
    const feature = context.feature!;

    // vector tile spec only supports integer values for feature ids -
    // allowing non-integer values here results in a non-compliant PBF
    // that causes an exception when it is parsed with vector-tile-js
    if (feature.id !== undefined && Number.isSafeInteger(+feature.id)) {
        pbf.writeVarintField(1, +feature.id);
    }

    if (feature.tags) pbf.writeMessage(2, writeProperties, context);
    pbf.writeVarintField(3, feature.type === 4 ? 1 : feature.type);
    pbf.writeMessage(4, writeGeometry, feature);
}

function writeProperties({keys, values, feature}: FeatureContext, pbf: PbfWriter) {
    const tags = feature!.tags!;
    for (const key of Object.keys(tags)) {
        let value = tags[key];
        if (value === null) continue; // don't encode null value properties

        let keyIndex = keys.get(key);

        if (keyIndex === undefined) {
            keyIndex = keys.size;
            keys.set(key, keyIndex);
        }
        pbf.writeVarint(keyIndex);

        const type = typeof value;
        if (type !== 'string' && type !== 'boolean' && type !== 'number') {
            value = JSON.stringify(value);
        }

        let valueIndex = values.get(value);

        if (valueIndex === undefined) {
            valueIndex = values.size;
            values.set(value, valueIndex);
        }
        pbf.writeVarint(valueIndex);
    }
}

function command(cmd: number, length: number): number {
    return (length << 3) + (cmd & 0x7);
}

function zigzag(num: number): number {
    return (num << 1) ^ (num >> 31);
}

function writeGeometry(feature: Feature, pbf: PbfWriter) {
    if (feature.type === 4) {
        pbf.writeVarint(command(1, 1)); // moveto
        pbf.writeVarint(zigzag(feature.x));
        pbf.writeVarint(zigzag(feature.y));
        return;
    }

    let x = 0;
    let y = 0;

    if (feature.type === 1) {
        const {geometry} = feature;
        pbf.writeVarint(command(1, geometry.length >> 1)); // moveto

        for (let i = 0; i < geometry.length; i += 2) {
            const dx = geometry[i]! - x;
            const dy = geometry[i + 1]! - y;
            pbf.writeVarint(zigzag(dx));
            pbf.writeVarint(zigzag(dy));
            x += dx;
            y += dy;
        }

    } else {
        const isPolygon = feature.type === 3;
        for (const ring of feature.geometry) {
            if (ring.length === 0) continue;
            pbf.writeVarint(command(1, 1));
            const lineCount = (ring.length >> 1) - (isPolygon ? 1 : 0); // do not write polygon closing path as lineto
            for (let i = 0; i < lineCount; i++) {
                if (i === 1) pbf.writeVarint(command(2, lineCount - 1));
                const dx = ring[2 * i]! - x;
                const dy = ring[2 * i + 1]! - y;
                pbf.writeVarint(zigzag(dx));
                pbf.writeVarint(zigzag(dy));
                x += dx;
                y += dy;
            }
            if (isPolygon) {
                pbf.writeVarint(command(7, 1)); // closepath
            }
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeValue(value: any, pbf: PbfWriter) {
    const type = typeof value;
    if (type === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        pbf.writeStringField(1, value);
    } else if (type === 'boolean') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        pbf.writeBooleanField(7, value);
    } else if (type === 'number') {
        if (value % 1 !== 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            pbf.writeDoubleField(3, value);
        } else if (value < 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            pbf.writeSVarintField(6, value);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            pbf.writeVarintField(5, value);
        }
    }
}
