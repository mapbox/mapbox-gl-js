'use strict';

//var ref = require('../lib/reference')('v3');

var vc;

module.exports = function(v3) {
    //v3.version = 3.1;
    vc = v3.constants;
    v3.layers.forEach(convertLayer);
    return v3;
};

var newTypes = {
    point: 'Point',
    line: 'LineString',
    polygon: 'Polygon'
};

function convertLayer(layer) {
    var render = layer.render;

    if (!render) return;

    if (layer.filter && layer.filter.$type) {
        layer.filter.$type = newTypes[layer.filter.$type];
    }

    if (render.type === 'text' || render.type === 'icon') {
        render.type = 'symbol';

        rename(render, 'icon-spacing', 'symbol-min-distance');
        rename(render, 'text-min-distance', 'symbol-min-distance');
        rename(render, 'icon-allow-overlap', 'symbol-allow-overlap');
        rename(render, 'text-allow-overlap', 'symbol-allow-overlap');
        rename(render, 'icon-ignore-placement', 'symbol-ignore-placement');
        rename(render, 'text-ignore-placement', 'symbol-ignore-placement');

        if (layer.style && layer.style['icon-rotate-anchor']) {
            render['symbol-rotation-alignment'] = layer.style['icon-rotate-anchor'];
            delete layer.style['icon-rotate-anchor'];
        }

        if (render['text-path' === 'curve']) {
            render['symbol-rotation-alignment'] = 'map';
            render.placement = 'line';
        }

        var convertHalo = function(haloWidth, textSize) {
            return Number(((6 - haloWidth * 8) * textSize / 24).toFixed(2));
        }

        if (layer.style && layer.style['text-halo-width']) {
            // if (layer.style['text-size']) console.log(layer.style['text-size']);
            if (typeof(layer.style['text-size']) == 'string' && layer.style['text-size'].indexOf('@') != -1) console.log(vc[layer.style['text-size']]);
                // cool so this works ^^ fix this vv
            var textSize = layer.style['text-size'] ? typeof(layer.style['text-size']) == 'number' : vc[layer.style['text-size']];
            if (typeof(textSize) == 'number') {
                layer.style['text-halo-width'] = convertHalo(layer.style['text-halo-width'], textSize)
            } else if (textSize && textSize['stops']) {
                var stops = []
                textSize['stops'].forEach(function(stop) {
                    stops.push([stop[0], convertHalo(layer.style['text-halo-width'], stop[1])]);
                })
                layer.style['text-halo-width'] = {
                    "fn": "stops",
                    "stops": stops
                }
            }
        }
        if (layer.style && layer.style['text-halo-blur']) {
        }

        delete render['text-path'];
    }
    if (layer.layers) layer.layers.forEach(convertLayer);
}

function rename(render, from, to) {
    if (render[from]) {
        render[to] = render[from];
        delete render[from];
    }
}
