'use strict';

var Interaction = require('./interaction.js');
var util = require('../util/util.js');
var Point = require('../geometry/point.js');

module.exports = Handlers;

function Handlers(map) {

    var rotateEnd;

    this.interaction = new Interaction(map.container)
        .on('click', function(x, y) {
            map.fire('click', [x, y]);
        })
        .on('hover', function(x, y) {
            map.fire('hover', [x, y]);
        })
        .on('resize', function() {
            map.stop();
            map.resize();
            map.update();
        })
        .on('pan', function(x, y) {
            map.stop();
            map.transform.panBy(new Point(x, y));
            map.update();
            map
                .fire('pan')
                .fire('move');
        })
        .on('panend', function(x, y) {
            map._stopFn = util.timed(function(t) {
                map.transform.panBy(new Point(
                    Math.round(x * (1 - t)),
                    Math.round(y * (1 - t))));
                map.update();
                map
                    .fire('pan')
                    .fire('move');
            }, 500);
        })
        .on('zoom', function(type, delta, x, y) {
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100)));
            if (delta < 0 && scale !== 0) scale = 1 / scale;

            var fromScale = map.ease && isFinite(delta) ? map.ease.to : map.transform.scale,
                duration = !isFinite(delta) ? 800 : type == 'trackpad' ? 0 : 300;

            map.scaleTo(fromScale * scale, duration, {x: x, y: y});
        })
        .on('rotate', function(beginning, start, end) {
            var center = map.transform.centerPoint, // Center of rotation
                beginningToCenter = beginning.sub(center),
                beginningToCenterDist = beginningToCenter.mag();

            // If the first click was too close to the center, move the center of rotation by 200 pixels
            // in the direction of the click.
            if (beginningToCenterDist < 200) {
                center = beginning.add(new Point(-200, 0)._rotate(beginningToCenter.angle()));
            }

            map.setAngle(map.transform.angle + start.sub(center).angleWith(end.sub(center)));

            map.rotating = true;
            window.clearTimeout(rotateEnd);
            rotateEnd = window.setTimeout(function() {
                map.rotating = false;
                map._rerender();
            }, 200);
        });
}
