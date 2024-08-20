import Reference from './reference/v8.json';

import type {StylePropertySpecification} from './style-spec';
import type {
    StyleSpecification,
    SourceSpecification,
    LayerSpecification,
    PropertyValueSpecification
} from './types';

function getPropertyReference(propertyName: string): StylePropertySpecification {
    for (let i = 0; i < Reference.layout.length; i++) {
        for (const key in Reference[Reference.layout[i]]) {
            if (key === propertyName) return Reference[Reference.layout[i]][key];
        }
    }
    for (let i = 0; i < Reference.paint.length; i++) {
        for (const key in Reference[Reference.paint[i]]) {
            if (key === propertyName) return Reference[Reference.paint[i]][key];
        }
    }

    return null as any;
}

export function eachSource(style: StyleSpecification, callback: (_: SourceSpecification) => void) {
    for (const k in style.sources) {
        callback(style.sources[k]);
    }
}

export function eachLayer(style: StyleSpecification, callback: (_: LayerSpecification) => void) {
    for (const layer of style.layers) {
        callback(layer);
    }
}

type PropertyCallback = (
    arg1: {
        path: [string, 'paint' | 'layout', string] // [layerid, paint/layout, property key];
        key: string;
        value: PropertyValueSpecification<unknown>  ;
        reference: StylePropertySpecification;
        set: (
            arg1: PropertyValueSpecification<unknown>,
        ) => void;
    },
) => void;

export function eachProperty(
    style: StyleSpecification,
    options: {
        paint?: boolean;
        layout?: boolean;
    },
    callback: PropertyCallback
) {
    function inner(layer: LayerSpecification, propertyType: 'paint' | 'layout') {
        if (layer.type === 'slot' || layer.type === 'clip') return;
        const properties = (layer[propertyType] as any);
        if (!properties) return;
        Object.keys(properties).forEach((key) => {
            callback({
                path: [layer.id, propertyType, key],
                key,
                value: properties[key],
                reference: getPropertyReference(key),
                set(x) {
                    properties[key] = x;
                }
            });
        });
    }

    eachLayer(style, (layer) => {
        if (options.paint) {
            inner(layer, 'paint');
        }
        if (options.layout) {
            inner(layer, 'layout');
        }
    });
}
