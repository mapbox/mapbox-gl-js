
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

    var layerParents = {};

    function parseLayers(layers, parentId) {
        var layersOut = [];
        for (var i = 0; i < layers.length; i++) {
            var layerId = layers[i].id;

            if (parentId) {
                layerParents[layerId] = parentId;
            }

            if (layers[i].layers) {
                // TODO flatten if not composited?
                layersOut.push({
                    id: layerId,
                    layers: parseLayers(layers[i].layers, layerId)
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
        'min-zoom': true,

        'line-cap': true,
        'line-join': true,
        'line-round-limit': true,

        'point-spacing': true,
        'point-size': true,

        'text-field': true,
        'text-font': true,
        'text-max-size': true,
        'text-path': true,
        'text-padding': true,
        'text-min-dist': true,
        'text-max-angle': true,
        'text-always-visible': true
    };

    function moveStyle(style, bucket, className, layerId) {
        for (var rule in style) {
            var typeMatches = rule.match(/(point|line|fill|text)-/);
            if (bucket && typeMatches) {
                bucket[typeMatches[1]] = true;
            }

            var value = style[rule];

            if (bucket && (rule in bucketRules)) {
                bucket[rule] = value;
            } else if ((!bucket &&
                    (rule === 'opacity' || rule === 'transition-opacity' || layerId === 'background')) ||
                    (bucket && rule !== 'opacity' && rule !== 'transition-opacity')) {
                var newStyle = out.styles[className] = out.styles[className] || {};
                newStyle[layerId] = newStyle[layerId] || {};
                newStyle[layerId][rule] = value;
            }
        }
    }

    for (var className in style.styles) {
        var classStyles = style.styles[className];

        for (var layerId in style.styles[className]) {

            var bucket = out.buckets[layerToBucket[layerId]],
                styles = [classStyles[layerId]],
                parentId = layerId;

            while (parentId = layerParents[parentId]) {
                var parentStyle = classStyles[parentId];
                if (parentStyle) {
                    styles.push(parentStyle);
                }
            }

            for (var i = styles.length; i >= 0; i--) {
                moveStyle(styles[i], bucket, className, layerId);
            }
        }
    }

    return out;
};
