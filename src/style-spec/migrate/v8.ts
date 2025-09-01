/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {eachSource, eachLayer, eachProperty} from '../visit';

function eachLayout(layer, callback) {
    for (const k in layer) {
        if (k.indexOf('layout') === 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            callback(layer[k], k);
        }
    }
}

function eachPaint(layer, callback) {
    for (const k in layer) {
        if (k.indexOf('paint') === 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            callback(layer[k], k);
        }
    }
}

function resolveConstant(style, value) {
    if (typeof value === 'string' && value[0] === '@') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return resolveConstant(style, style.constants[value]);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
    }
}

function isFunction(value) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Array.isArray(value.stops);
}

function renameProperty(obj, from, to) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    obj[to] = obj[from]; delete obj[from];
}

export default function (style) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    style.version = 8;

    // Rename properties, reverse coordinates in source and layers
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    eachSource(style, (source) => {
        if (source.type === 'video' && source.url !== undefined) {
            renameProperty(source, 'url', 'urls');
        }
        if (source.type === 'video') {
            source.coordinates.forEach((coord) => {
                return coord.reverse();
            });
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    eachLayer(style, (layer) => {
        eachLayout(layer, (layout) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (layout['symbol-min-distance'] !== undefined) {
                renameProperty(layout, 'symbol-min-distance', 'symbol-spacing');
            }
        });

        eachPaint(layer, (paint) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (paint['background-image'] !== undefined) {
                renameProperty(paint, 'background-image', 'background-pattern');
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (paint['line-image'] !== undefined) {
                renameProperty(paint, 'line-image', 'line-pattern');
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (paint['fill-image'] !== undefined) {
                renameProperty(paint, 'fill-image', 'fill-pattern');
            }
        });
    });

    // Inline Constants
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    eachProperty(style, {paint: true, layout: true}, (property) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const value = resolveConstant(style, property.value);

        if (isFunction(value)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            value.stops.forEach((stop) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                stop[1] = resolveConstant(style, stop[1]);
            });
        }

        property.set(value);
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete style.constants;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    eachLayer(style, (layer) => {
        // get rid of text-max-size, icon-max-size
        // turn text-size, icon-size into layout properties
        // https://github.com/mapbox/mapbox-gl-style-spec/issues/255

        eachLayout(layer, (layout) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete layout['text-max-size'];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete layout['icon-max-size'];
        });

        eachPaint(layer, (paint) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (paint['text-size']) {
                if (!layer.layout) layer.layout = {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                layer.layout['text-size'] = paint['text-size'];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                delete paint['text-size'];
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (paint['icon-size']) {
                if (!layer.layout) layer.layout = {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                layer.layout['icon-size'] = paint['icon-size'];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                delete paint['icon-size'];
            }
        });
    });

    function migrateFontstackURL(input) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const inputParsed = new URL(input);
        const inputPathnameParts = inputParsed.pathname.split('/');

        if (inputParsed.protocol !== 'mapbox:') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return input;

        } else if (inputParsed.hostname === 'fontstack') {
            assert(decodeURI(inputParsed.pathname) === '/{fontstack}/{range}.pbf');
            return 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf';

        } else if (inputParsed.hostname === 'fonts') {
            assert(inputPathnameParts[1] === 'v1');
            assert(decodeURI(inputPathnameParts[3]) === '{fontstack}');
            assert(decodeURI(inputPathnameParts[4]) === '{range}.pbf');
            return `mapbox://fonts/${inputPathnameParts[2]}/{fontstack}/{range}.pbf`;

        } else {
            assert(false);
        }

        function assert(predicate) {
            if (!predicate) {
                throw new Error(`Invalid font url: "${input}"`);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (style.glyphs) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        style.glyphs = migrateFontstackURL(style.glyphs);
    }

    function migrateFontStack(font) {
        function splitAndTrim(string) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return string.split(',').map((s) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                return s.trim();
            });
        }

        if (Array.isArray(font)) {
            // Assume it's a previously migrated font-array.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return font;

        } else if (typeof font === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return splitAndTrim(font);

        } else if (typeof font === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            font.stops.forEach((stop) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                stop[1] = splitAndTrim(stop[1]);
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return font;

        } else {
            throw new Error("unexpected font value");
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    eachLayer(style, (layer) => {
        eachLayout(layer, (layout) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (layout['text-font']) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (let i = style.layers.length - 1; i >= 0; i--) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const layer = style.layers[i];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (layer.type !== 'symbol') {
            firstSymbolLayer = i + 1;
            break;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const symbolLayers = style.layers.splice(firstSymbolLayer);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    symbolLayers.reverse();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    style.layers = style.layers.concat(symbolLayers);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return style;
}
