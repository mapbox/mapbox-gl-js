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
        .on('zoom', function(e) {
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(e.delta / 100)));
            if (e.delta < 0 && scale !== 0) scale = 1 / scale;

            var fromScale = map.ease && isFinite(e.delta) ? map.ease.to : map.transform.scale,
                duration = !isFinite(e.delta) ? 800 : 0,
                targetZoom = map.transform.scaleZoom(fromScale * scale);

            map.zoomTo(targetZoom, {
                duration: duration,
                around: map.unproject(e.point)
            });
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
