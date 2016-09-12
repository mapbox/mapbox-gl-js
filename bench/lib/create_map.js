'use strict';

var util = require('../../js/util/util');
var mapboxgl = require('../../js/mapbox-gl');

module.exports = function createMap(options) {
    options = util.extend({width: 512, height: 512}, options);

    var element = document.createElement('div');
    element.style.width = options.width + 'px';
    element.style.height = options.height + 'px';
    element.style.margin = '0 auto';
    document.body.appendChild(element);

    mapboxgl.accessToken = require('./access_token');

    var map = new mapboxgl.Map(util.extend({
        container: element,
        style: 'mapbox://styles/mapbox/streets-v9',
        interactive: false
    }, options));

    map.on('remove', function() {
        map.getContainer().remove();
    });

    return map;
};
