'use strict';

var vc;

module.exports = function(v4) {
    v4.version = 4;
    vc = v4.constants;
    convertConstants(vc);
    rmTileSize(v4.sources);
    v4.layers.forEach(convertLayer);
    return v4;
};

function rmTileSize(sources) {
    for (var source in sources) {
        if (sources[source]['type'] != 'raster' && sources[source]['tileSize']) delete sources[source]['tileSize'];
    }
}

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
            if (Array.isArray(style[propname])) {
                for (var prop in style[propname]) {
                    if (!style[propname][prop].fn) continue;
                    style[propname][prop] = fnBucket(style[propname][prop])
                }
            };
            if (!style[propname].fn) continue;
            style[propname] = fnBucket(style[propname]);
        }
    }

    if (layer.layers) layer.layers.forEach(convertLayer);

}

function convertConstants(constants) {
    for (var constant in constants) {
        if (constants[constant].fn) {
            constants[constant] = fnBucket(constants[constant]);
        };

        if (Array.isArray(constants[constant])) {
            for (var item in constants[constant]) {
                if (constants[constant][item].fn) {
                    constants[constant][item] = fnBucket(constants[constant][item]);
                };
            }
        };
    }
}

function fnBucket(oldfn) {
    var newfn;
    if (oldfn.fn === 'stops') {
        newfn = { stops: oldfn.stops };
    } else if (oldfn.fn === 'linear' || oldfn.fn === 'exponential') {
        newfn = migrateFn(oldfn);
    }
    // Decrement zoom levels by 1.
    newfn.stops = newfn.stops.map(deczoom);
    return newfn;
}

function deczoom(pair) {
    return [Math.max(0, pair[0] - 1), pair[1]];
}

function migrateFn(params) {
    var newparams = {};
    var minZoom = 0;
    var maxZoom = 20;
    var fn;
    if (params.fn === 'exponential') {
        fn = exponential(params);
        if (params.base) newparams.base = params.base;
        if (params.min !== undefined) minZoom = reverseExponential(params, Math.max(params.min, params.val));
        if (params.max !== undefined) maxZoom = reverseExponential(params, params.max);
        newparams.stops = [
            [minZoom, fn(minZoom)],
            [maxZoom, fn(maxZoom)]
        ];
    } else if (params.fn === 'linear') {
        fn = linear(params);
        newparams.base = 1.01;
        if (params.min !== undefined) minZoom = reverseLinear(params, params.min);
        if (params.max !== undefined) maxZoom = reverseLinear(params, params.max);
        newparams.stops = [
            [minZoom, fn(minZoom)],
            [maxZoom, fn(maxZoom)]
        ];
    }

    return newparams;
}

function reverseExponential(params, value) {
    var z_base = +params.z || 0,
        val = +params.val || 0,
        slope = +params.slope || 0,
        base = +params.base || 1.75;
    return Math.log(((value - val) || 0.01) / slope) / Math.log(base) + z_base;
}

function reverseLinear(params, value) {
    var z_base = +params.z || 0,
        val = +params.val || 0,
        slope = +params.slope || 0;
    return (value - val) / slope + z_base;
}

function linear(params) {
    var z_base = +params.z || 0,
        val = +params.val || 0,
        slope = +params.slope || 0,
        min = +params.min || 0,
        max = +params.max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + (z - z_base) * slope), max);
    };
}

function exponential(params) {
    var z_base = +params.z || 0,
        val = +params.val || 0,
        slope = +params.slope || 0,
        min = +params.min || 0,
        max = +params.max || Infinity,
        base = +params.base || 1.75;
    return function(z) {
        return Math.min(Math.max(min, val + Math.pow(base, (z - z_base)) * slope), max);
    };
}
