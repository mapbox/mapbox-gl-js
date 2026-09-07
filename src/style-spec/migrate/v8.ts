import {eachSource, eachLayer, eachProperty} from '../visit';

type LegacyObject = Record<string, unknown>;
type LegacyFunctionStop = [unknown, unknown];
type LegacyFunction = {stops: LegacyFunctionStop[]};
type LegacySource = LegacyObject & {type?: string; url?: unknown; coordinates?: unknown[][]};
type LegacyLayer = LegacyObject & {type?: string; layout?: LegacyObject};
type LegacyStyle = {
    version: number;
    constants?: LegacyObject;
    glyphs?: string;
    layers?: LegacyLayer[];
};
type Migrated<T> = Omit<T, 'version'> & {version: 8};
type Each<T> = (style: LegacyStyle, callback: (value: T) => void) => void;
type EachProperty = (
    style: LegacyStyle,
    options: {paint?: boolean; layout?: boolean},
    callback: (property: {value: unknown; set: (value: unknown) => void}) => void
) => void;

function eachLayout(layer: LegacyLayer, callback: (layout: LegacyObject, key: string) => void): void {
    for (const k in layer) {
        if (k.indexOf('layout') === 0) {
            callback(layer[k] as LegacyObject, k);
        }
    }
}

function eachPaint(layer: LegacyLayer, callback: (paint: LegacyObject, key: string) => void): void {
    for (const k in layer) {
        if (k.indexOf('paint') === 0) {
            callback(layer[k] as LegacyObject, k);
        }
    }
}

function resolveConstant(style: LegacyStyle, value: unknown): unknown {
    if (typeof value === 'string' && value[0] === '@') {
        return resolveConstant(style, style.constants![value]);
    } else {
        return value;
    }
}

function isFunction(value: unknown): value is LegacyFunction {
    return Array.isArray((value as LegacyFunction).stops);
}

function renameProperty(obj: LegacyObject, from: string, to: string): void {
    obj[to] = obj[from]; delete obj[from];
}

export default function <T extends LegacyStyle>(style: T): Migrated<T> {
    style.version = 8;

    // Rename properties, reverse coordinates in source and layers
    (eachSource as unknown as Each<LegacySource>)(style, (source) => {
        if (source.type === 'video' && source.url !== undefined) {
            renameProperty(source, 'url', 'urls');
        }
        if (source.type === 'video') {
            source.coordinates!.forEach((coord) => {
                return coord.reverse();
            });
        }
    });

    (eachLayer as unknown as Each<LegacyLayer>)(style, (layer) => {
        eachLayout(layer, (layout) => {
            if (layout['symbol-min-distance'] !== undefined) {
                renameProperty(layout, 'symbol-min-distance', 'symbol-spacing');
            }
        });

        eachPaint(layer, (paint) => {
            if (paint['background-image'] !== undefined) {
                renameProperty(paint, 'background-image', 'background-pattern');
            }
            if (paint['line-image'] !== undefined) {
                renameProperty(paint, 'line-image', 'line-pattern');
            }
            if (paint['fill-image'] !== undefined) {
                renameProperty(paint, 'fill-image', 'fill-pattern');
            }
        });
    });

    // Inline Constants
    (eachProperty as unknown as EachProperty)(style, {paint: true, layout: true}, (property) => {
        const value = resolveConstant(style, property.value);

        if (isFunction(value)) {
            value.stops.forEach((stop) => {
                stop[1] = resolveConstant(style, stop[1]);
            });
        }

        property.set(value);
    });
    delete style.constants;

    (eachLayer as unknown as Each<LegacyLayer>)(style, (layer) => {
        // get rid of text-max-size, icon-max-size
        // turn text-size, icon-size into layout properties
        // https://github.com/mapbox/mapbox-gl-style-spec/issues/255

        eachLayout(layer, (layout) => {
            delete layout['text-max-size'];
            delete layout['icon-max-size'];
        });

        eachPaint(layer, (paint) => {
            if (paint['text-size']) {
                if (!layer.layout) layer.layout = {};
                layer.layout['text-size'] = paint['text-size'];
                delete paint['text-size'];
            }

            if (paint['icon-size']) {
                if (!layer.layout) layer.layout = {};
                layer.layout['icon-size'] = paint['icon-size'];
                delete paint['icon-size'];
            }
        });
    });

    function migrateFontstackURL(input: string): string {
        const inputParsed = new URL(input);
        const inputPathnameParts = inputParsed.pathname.split('/');

        if (inputParsed.protocol !== 'mapbox:') {
            return input;

        } else if (inputParsed.hostname === 'fontstack') {
            assert(decodeURI(inputParsed.pathname) === '/{fontstack}/{range}.pbf');
            return 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf';

        } else if (inputParsed.hostname === 'fonts') {
            assert(inputPathnameParts[1] === 'v1');
            assert(decodeURI(inputPathnameParts[3]!) === '{fontstack}');
            assert(decodeURI(inputPathnameParts[4]!) === '{range}.pbf');
            return `mapbox://fonts/${inputPathnameParts[2]!}/{fontstack}/{range}.pbf`;

        } else {
            assert(false);
        }

        function assert(predicate: boolean): asserts predicate {
            if (!predicate) {
                throw new Error(`Invalid font url: "${input}"`);
            }
        }
    }

    if (style.glyphs) {
        style.glyphs = migrateFontstackURL(style.glyphs);
    }

    function migrateFontStack(font: unknown): unknown {
        function splitAndTrim(string: string): string[] {
            return string.split(',').map((s) => {
                return s.trim();
            });
        }

        if (Array.isArray(font)) {
            // Assume it's a previously migrated font-array.
            return font;

        } else if (typeof font === 'string') {
            return splitAndTrim(font);

        } else if (typeof font === 'object') {
            (font as LegacyFunction).stops.forEach((stop) => {
                stop[1] = splitAndTrim(stop[1] as string);
            });
            return font;

        } else {
            throw new Error("unexpected font value");
        }
    }

    (eachLayer as unknown as Each<LegacyLayer>)(style, (layer) => {
        eachLayout(layer, (layout) => {
            if (layout['text-font']) {
                layout['text-font'] = migrateFontStack(layout['text-font']);
            }
        });
    });

    // Reverse order of symbol layers. This is an imperfect migration.
    //
    // The order of a symbol layer in the layers list affects two things:
    // - how it is drawn relative to other layers (like oneway arrows below bridges)
    // - the placement priority compared to other layers
    //
    // It's impossible to reverse the placement priority without breaking the draw order
    // in some cases. This migration only reverses the order of symbol layers that
    // are above all other types of layers.
    //
    // Symbol layers that are at the top of the map preserve their priority.
    // Symbol layers that are below another type (line, fill) of layer preserve their draw order.

    let firstSymbolLayer = 0;
    for (let i = style.layers!.length - 1; i >= 0; i--) {
        const layer = style.layers![i]!;
        if (layer.type !== 'symbol') {
            firstSymbolLayer = i + 1;
            break;
        }
    }

    const symbolLayers = style.layers!.splice(firstSymbolLayer);
    symbolLayers.reverse();
    style.layers = style.layers!.concat(symbolLayers);

    return style as Migrated<T>;
}
