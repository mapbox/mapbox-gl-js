import EXTENT from '../style-spec/data/extent';
import Pbf from 'pbf';

import type {Feature} from './geojson_wrapper';

/**
 * Encodes a set of GeoJSON-like features as vector tiles.
 * @private
 */
export default function writeFeatures(layers: Record<string, Feature[]>) {
    const pbf = new Pbf();
    for (const name of Object.keys(layers)) {
        const features = layers[name];
        pbf.writeMessage(3, writeLayer, {name, features});
    }
    return pbf.finish();
}

function writeLayer({name, features}: {name: string, features: Feature[]}, pbf: Pbf) {
    pbf.writeStringField(1, name);
    pbf.writeVarintField(5, EXTENT);

    const keys = new Map();
    const values = new Map();

    const context = {
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

type FeatureContext = {keys: Map<string, number>, values: Map<unknown, number>, feature: Feature};

function writeFeature(context: FeatureContext, pbf: Pbf) {
    const feature = context.feature;

    // vector tile spec only supports integer values for feature ids -
    // allowing non-integer values here results in a non-compliant PBF
    // that causes an exception when it is parsed with vector-tile-js
    if (feature.id !== undefined && Number.isSafeInteger(+feature.id)) {
        pbf.writeVarintField(1, +feature.id);
    }

    if (feature.tags) pbf.writeMessage(2, writeProperties, context);
    pbf.writeVarintField(3, feature.type);
    pbf.writeMessage(4, writeGeometry, feature);
}

function writeProperties({keys, values, feature}: FeatureContext, pbf: Pbf) {
    for (const key of Object.keys(feature.tags)) {
        let value = feature.tags[key];
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

function writeGeometry(feature: Feature, pbf: Pbf) {
    const {geometry, type} = feature;
    let x = 0;
    let y = 0;

    if (type === 1) {
        pbf.writeVarint(command(1, geometry.length)); // moveto

        for (const p of geometry) {
            const dx = p[0] - x;
            const dy = p[1] - y;
            pbf.writeVarint(zigzag(dx));
            pbf.writeVarint(zigzag(dy));
            x += dx;
            y += dy;
        }

    } else {
        for (const ring of geometry) {
            pbf.writeVarint(command(1, 1));
            const lineCount = ring.length - (type === 3 ? 1 : 0); // do not write polygon closing path as lineto
            for (let i = 0; i < lineCount; i++) {
                if (i === 1) pbf.writeVarint(command(2, lineCount - 1));
                const dx = ring[i][0] - x;
                const dy = ring[i][1] - y;
                pbf.writeVarint(zigzag(dx));
                pbf.writeVarint(zigzag(dy));
                x += dx;
                y += dy;
            }
            if (type === 3) {
                pbf.writeVarint(command(7, 1)); // closepath
            }
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeValue(value: any, pbf: Pbf) {
    const type = typeof value;
    if (type === 'string') {
        pbf.writeStringField(1, value);
    } else if (type === 'boolean') {
        pbf.writeBooleanField(7, value);
    } else if (type === 'number') {
        if (value % 1 !== 0) {
            pbf.writeDoubleField(3, value);
        } else if (value < 0) {
            pbf.writeSVarintField(6, value);
        } else {
            pbf.writeVarintField(5, value);
        }
    }
}
