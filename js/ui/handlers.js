'use strict';

var Interaction = require('./interaction.js');
var util = require('../util/util.js');

module.exports = Handlers;

function Handlers(map) {

    var rotateEnd, zoomEnd;

    this.interaction = new Interaction(map.container)
        .on('click', function(x, y) {
            map.fire('click', [x, y]);
        })
        .on('hover', function(x, y) {
            map.fire('hover', [x, y]);
        })
        .on('resize', function() {
            if (map.cancelTransform) { map.cancelTransform(); }
            map.resize();
            map.update();
        })
        .on('pan', function(x, y) {
            if (map.cancelTransform) { map.cancelTransform(); }
            map.transform.panBy(x, y);
            map.fire('move');
            map.update();
        })
        .on('panend', function(x, y) {
            if (map.cancelTransform) { map.cancelTransform(); }
            map.cancelTransform = util.timed(function(t) {
                map.transform.panBy(Math.round(x * (1 - t)), Math.round(y * (1 - t)));
                map._updateStyle();
                map.update();
            }, 500);
        })
        .on('zoom', function(delta, x, y) {
            if (map.cancelTransform) { map.cancelTransform(); }
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100) / 4));
            if (delta < 0 && scale !== 0) scale = 1 / scale;

            var fromScale = map.ease ? map.ease.to : map.transform.scale;

            if (delta === Infinity || delta === -Infinity) {
                map.scaleTo(map.transform.scale * scale, 800, { x: x, y: y });
            } else {
                map.scaleTo(fromScale * scale, 300, { x: x, y: y });
            }

            map.zooming = true;
            map.style.addClass(':zooming');
            window.clearTimeout(zoomEnd);
            zoomEnd = window.setTimeout(function() {
                map.zooming = false;
                map.style.removeClass(':zooming');
                map._rerender();
            }, 200);
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

            map.fire('move');
            map.setAngle(center, map.transform.angle + util.angleBetween(util.vectorSub(start, center), util.vectorSub(end, center)));

            map.rotating = true;
            window.clearTimeout(rotateEnd);
            rotateEnd = window.setTimeout(function() {
                map.rotating = false;
                map._rerender();
            }, 200);
        });
}
