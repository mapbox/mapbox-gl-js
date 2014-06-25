'use strict';

var Interaction = require('./interaction.js');
var util = require('../util/util.js');
var Point = require('point-geometry');

module.exports = Handlers;

function Handlers(map) {

    var rotateEnd;

    this.interaction = new Interaction(map.container)
        .on('click', function(e) {
            map.fire('click', e);
        })
        .on('hover', function(e) {
            map.fire('hover', e);
        })
        .on('resize', function() {
            map.stop();
            map.resize();
            map.update();
        })
        .on('pan', function(e) {
            map.stop();
            map.transform.panBy(e.offset);
            map.update();
            map
                .fire('pan')
                .fire('move');
        })
        .on('panend', function(e) {
            map._stopFn = util.timed(function(t) {
                map.transform.panBy(e.inertia.mult(1 - t).round());
                map.update();
                map
                    .fire('pan')
                    .fire('move');
            }, 500);
        })
        .on('zoom', function(e) {
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(e.delta / 100)));
            if (e.delta < 0 && scale !== 0) scale = 1 / scale;

            var fromScale = map.ease && isFinite(e.delta) ? map.ease.to : map.transform.scale,
                duration = !isFinite(e.delta) ? 800 : e.source == 'trackpad' ? 0 : 300;

            map.scaleTo(fromScale * scale, {
                duration: duration,
                offset: e.point.sub(map.transform.centerPoint)
            });
        })
        .on('rotate', function(e) {
            var center = map.transform.centerPoint, // Center of rotation
                startToCenter = e.start.sub(center),
                startToCenterDist = startToCenter.mag();

            // If the first click was too close to the center, move the center of rotation by 200 pixels
            // in the direction of the click.
            if (startToCenterDist < 200) {
                center = e.start.add(new Point(-200, 0)._rotate(startToCenter.angle()));
            }

            map.setBearing(map.getBearing() - e.prev.sub(center).angleWith(e.current.sub(center)) / Math.PI * 180);

            map.rotating = true;
            window.clearTimeout(rotateEnd);
            rotateEnd = window.setTimeout(function() {
                map.rotating = false;
                map._rerender();
            }, 200);
        });
}
