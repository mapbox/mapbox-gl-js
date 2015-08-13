'use strict';

module.exports = function (style) {
    var styleIDs = [],
        sourceIDs = [];

    for (var id in style.sources) {
        var source = style.sources[id];

        if (source.type !== "vector")
            continue;

        var match = /^mapbox:\/\/(.*)/.exec(source.url);
        if (!match)
            continue;

        styleIDs.push(id);
        sourceIDs.push(match[1]);
    }

    if (styleIDs.length < 2)
        return style;

    styleIDs.forEach(function (id) {
        delete style.sources[id];
    });

    var compositeID = sourceIDs.join(",");

    style.sources[compositeID] = {
        "type": "vector",
        "url": "mapbox://" + compositeID
    };

    style.layers.forEach(function (layer) {
        if (styleIDs.indexOf(layer.source) >= 0) {
            layer.source = compositeID;
        }
    });

    return style;
};
