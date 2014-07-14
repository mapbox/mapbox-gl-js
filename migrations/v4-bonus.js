'use strict';

var vc;

module.exports = function(v4) {
    v4.version = 4;
    vc = v4.constants;
    v4.layers.forEach(convertLayer);
    return v4;
};

function convertLayer(layer) {
    // convert linear/exponential functions to stop functions
    // decrement zoom level of functions by 1 for map tileSize (512) change
    for (var classname in layer) {
        if (layer[classname]['text-max-angle']) {
            layer[classname]['text-max-angle'] = Number((layer[classname]['text-max-angle'] * 180 / Math.PI).toFixed(2));
        }
        if (classname.indexOf('style') === -1) continue;
        var style = layer[classname];
        for (var propname in style) {
            if (!style[propname].fn) continue;
            var oldfn = style[propname];
            var newfn;
            if (oldfn.fn === 'stops') {
                newfn = { stops: oldfn.stops };
            // @TODO convert linear/exponential functions into stops functions.
            } else if (oldfn.fn === 'linear') {
                newfn = { stops: [] };
            } else if (oldfn.fn === 'exponential') {
                newfn = { stops: [] };
            }
            // Decrement zoom levels by 1.
            newfn.stops = newfn.stops.map(deczoom);
            style[propname] = newfn;
        }
    }

    function deczoom(pair) {
        return [Math.max(0, pair[0] - 1), pair[1]];
    }
}
