
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

    function parseBuckets(layers, parentFilter) {
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].layers) {
                parseBuckets(layers[i].layers, layers[i].filter);
            } else {
                var filter = (parentFilter ? parentFilter + ' && ' : '') + layers[i].filter,
                    layerId = layers[i].id;

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

    // console.log(layerToBucket);

    return out;
};
