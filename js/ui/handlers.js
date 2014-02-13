'use strict';

var Interaction = require('./interaction.js');
var util = require('../util/util.js');

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
            map.transform.panBy(x, y);
            map.update();
            map
                .fire('pan')
                .fire('move');
        })
        .on('panend', function(x, y) {
            map.panBy(x, y);
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
            var rect = map.container.getBoundingClientRect();
            var center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, // Center of rotation
                beginningToCenter = util.vectorSub(beginning, center),
                beginningToCenterDist = util.vectorMag(beginningToCenter);

            // If the first click was too close to the center, move the center of rotation by 200 pixels
            // in the direction of the click.
            if (beginningToCenterDist < 200) {
                center = util.vectorAdd(beginning, util.rotate(Math.atan2(beginningToCenter.y, beginningToCenter.x), { x: -200, y: 0 }));
            }

            map.setAngle(center, map.transform.angle + util.angleBetween(util.vectorSub(start, center), util.vectorSub(end, center)));

            map
                .fire('rotate')
                .fire('move');

            map.rotating = true;
            window.clearTimeout(rotateEnd);
            rotateEnd = window.setTimeout(function() {
                map.rotating = false;
                map._rerender();
            }, 200);
        });
}
