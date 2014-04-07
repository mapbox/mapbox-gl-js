
// converts latest version styles into renderer-friendly format consumed by llmr

module.exports = function (style) {
    var out = {
        buckets: {},
        layers: [],
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

    return out;
};
