'use strict';

var resolveTokens = require('../util/token');

module.exports = resolveIcons;

// For an array of features determine what icons need to be loaded.
function resolveIcons(features, layoutProperties) {
    var icons = [];

    for (var i = 0, fl = features.length; i < fl; i++) {
        var text = resolveTokens(features[i].properties, layoutProperties['icon-image']);
        if (!text) continue;

        if (icons.indexOf(text) < 0) {
            icons.push(text);
        }
    }

    return icons;
}
