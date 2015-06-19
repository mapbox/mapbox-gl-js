'use strict';

var Interaction = require('./interaction');

module.exports = Handlers;

function Handlers(map) {

    var startScale, startBearing;

    this.interaction = new Interaction(map.getCanvas())
        .on('click', function(e) {
            e.latLng = map.unproject(e.point);
            map.fire('click', e);
        })
        .on('dblclick', function(e) {
            e.latLng = map.unproject(e.point);
            map.fire('dblclick', e);
        })
        .on('mousemove', function(e) {
            e.latLng = map.unproject(e.point);
            map.fire('mousemove', e);
        })
        .on('resize', function() {
            map.stop();
            map.resize();
            map.update();
        })
        .on('pinchstart', function() {
            startScale = map.transform.scale;
            startBearing = map.transform.bearing;
        })
        .on('pinch', function(e) {
            map.easeTo({
                zoom: map.transform.scaleZoom(startScale * e.scale),
                bearing: startBearing + e.bearing,
                duration: 0,
                around: map.unproject(e.point)
            });
        });
}
