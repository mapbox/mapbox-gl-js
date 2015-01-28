'use strict';

var reference = require('./reference');

module.exports = {};

reference.layout.forEach(function(className) {
    var Properties = function(props) {
        for (var p in props) {
            this[p] = props[p];
        }
    };

    var properties = reference[className];
    for (var prop in properties) {
        if (properties[prop].default === undefined) continue;
        Properties.prototype[prop] = properties[prop].default;
    }
    module.exports[className.replace('layout_', '')] = Properties;
});
