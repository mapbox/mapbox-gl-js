'use strict';
var util = require('../../util/util');
var Control = require('./control');
var DOM = require('../../util/dom');

module.exports = Scale;

function Scale(options) {
    util.setOptions(this, options);
}

Scale.prototype = util.inherit(Control, {
    options: {
    position: 'bottom-left'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl';

        var container = this._container = DOM.create('div', className + '-group', map.getContainer());

        this._scale = DOM.create('div', ('mapboxgl-ctrl-scale'), this._container);

        _updateScale(map, container);
         map.on('moveend', function() {
            _updateScale(map, container);
         });        

        return container;
    }
});

function _updateScale(map, scale) {
  var y = map._container.clientHeight / 2;


  var maxMeters = _getDistance( map.unproject([0, y]), map.unproject([100, y]));

  var meters = _getRoundNum(maxMeters);

  var ratio = meters / maxMeters;

  scale.style.width = 100 * ratio + 'px';
  scale.innerHTML = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km'; 

}

function _getDistance(latlng1, latlng2) {
  var R = 6371000;

  var rad = Math.PI / 180,
      lat1 = latlng1.lat * rad,
      lat2 = latlng2.lat * rad,
      a = Math.sin(lat1) * Math.sin(lat2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.cos((latlng2.lng - latlng1.lng) * rad);

  var maxMeters = R * Math.acos(Math.min(a, 1));
  return maxMeters;

}

function _getRoundNum(num) {
   var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
        d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
        d >= 3 ? 3 :
        d >= 2 ? 2 : 1;

    return pow10 * d;
}