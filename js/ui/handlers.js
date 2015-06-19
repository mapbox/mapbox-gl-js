'use strict';

var Interaction = require('./interaction');

module.exports = Handlers;

function Handlers(map) {

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
        });
}
