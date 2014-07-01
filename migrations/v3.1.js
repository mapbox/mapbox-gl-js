'use strict';

//var ref = require('../lib/reference')('v3');

module.exports = function(v3) {
    //v3.version = 3.1;
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

        if (render['text-halo-width']) {
        }
        if (render['text-halo-blur']) {
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
