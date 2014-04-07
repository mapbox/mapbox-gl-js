
// converts latest version styles into renderer-friendly format consumed by llmr

module.exports = function (style) {
    var out = {
        buckets: {},
        layers: [],
        constants: style.constants,
        styles: {},
        sprite: style.sprite
    };

    var filterToBucket = {},
        layerToBucket = {},
        layerToFilter = {};


    // parse buckets

    function parseBuckets(layers, parentFilter) {
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].layers) {
                parseBuckets(layers[i].layers, layers[i].filter);
            } else {
                var filter = (parentFilter ? parentFilter + ' && ' : '') + layers[i].filter,
                    layerId = layers[i].id;

                if (layerId === 'background') continue;

                // we chose the shortest layer name as the bucket name for layers with the same filter
                if (!filterToBucket[filter] || layerId.length < filterToBucket[filter].length) {
                    filterToBucket[filter] = layerId;
                }

                layerToFilter[layerId] = filter;
            }
        }
    }

    parseBuckets(style.layers);

    for (var id in layerToFilter) {
        layerToBucket[id] = filterToBucket[layerToFilter[id]];
    }

    for (var filter in filterToBucket) {
        out.buckets[filterToBucket[filter]] = {
            filter: filter
        };
    }


    // parse layers (structure)

    function parseLayers(layers) {
        var layersOut = [];
        for (var i = 0; i < layers.length; i++) {
            var layerId = layers[i].id;

            if (layers[i].layers) {
                // TODO flatten if not composited?
                layersOut.push({
                    id: layerId,
                    layers: parseLayers(layers[i].layers)
                });
            } else {
                layersOut.push({
                    id: layerId,
                    bucket: layerToBucket[layerId]
                });
            }
        }
        return layersOut;
    }

    out.layers = parseLayers(style.layers);


    // parse style

    var bucketRules = {
        'min-zoom': false,

        'line-cap': 'line',
        'line-join': 'line',
        'line-round-limit': 'line',

        'point-spacing': 'point',
        'point-size': 'point',

        'text-field': 'text',
        'text-font': 'text',
        'text-max-size': 'text',
        'text-path': 'text',
        'text-padding': 'text',
        'text-min-dist': 'text',
        'text-max-angle': 'text',
        'text-always-visible': 'text'
    };

    for (var className in style.styles) {
        var newStyle = out.styles[className] = {},
            oldStyle = style.styles[className];

        for (var layerId in oldStyle) {
            newStyle[layerId] = {};

            for (var rule in oldStyle[layerId]) {

                var value = oldStyle[layerId][rule];

                if (rule in bucketRules) {
                    var bucket = out.buckets[layerToBucket[layerId]];

                    // set bucket type
                    if (bucketRules[rule]) {
                        bucket[bucketRules[rule]] = true;
                    }

                    bucket[rule] = value;

                } else {
                    newStyle[layerId][rule] = value;
                }
            }
        }
    }

    return out;
};
