/* global process */
'use strict';
var test = require('tape').test;
var fs = require('fs');
var AnimationLoop = require('../../../js/style/animationloop.js');
var Style = require('../../../js/style/style.js');
var stylesheet = require(__dirname + '/../../fixtures/style-basic.json');
var UPDATE = process.env.UPDATE;

test('style', function(t) {
    var style = new Style(stylesheet, new AnimationLoop());
    t.ok(style);

    // Replace changing startTime/endTime values with singe stable value
    // for fixture comparison.
    var style_transitions = JSON.parse(JSON.stringify(style.transitions, function(key, val) {
        if (key === 'startTime' || key === 'endTime') {
            return +new Date('Tue, 17 Jun 2014 0:00:00 UTC');
        } else {
            return val;
        }
    }));
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-transitions.json', JSON.stringify(style_transitions, null, 2));
    var style_transitions_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-transitions.json'));
    t.deepEqual(style_transitions, style_transitions_expected);

    style.recalculate(10);

    t.equal(style.hasClass('foo'), false, 'non-existent class');
    t.deepEqual(style.getClassList(), [], 'getClassList');
    t.deepEqual(style.removeClass('foo'), undefined, 'remove non-existent class');

    // layerGroups
    var style_layergroups = JSON.parse(JSON.stringify(style.layerGroups));
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-layergroups.json', JSON.stringify(style_layergroups, null, 2));
    var style_layergroups_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-layergroups.json'));
    t.deepEqual(style_layergroups, style_layergroups_expected);

    // Check non JSON-stringified properites of layerGroups arrays.
    t.deepEqual(style.layerGroups[0].source, 'mapbox.mapbox-streets-v5');
    t.deepEqual(style.layerGroups[0].dependencies, undefined);
    t.deepEqual(style.layerGroups[0].composited, undefined);
    t.deepEqual(style.layerGroups[1].source, undefined);
    t.deepEqual(JSONize(style.layerGroups[1].dependencies), { roads: [ [ { bucket: 'road', id: 'road', type: 'line' } ] ] });
    t.deepEqual(style.layerGroups[1].composited, true);
    t.deepEqual(style.layerGroups[2].source, 'mapbox.mapbox-streets-v5');
    t.deepEqual(style.layerGroups[2].dependencies, undefined);
    t.deepEqual(style.layerGroups[2].composited, undefined);

    // computed
    var style_computed = JSON.parse(JSON.stringify(style.computed));
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-computed.json', JSON.stringify(style_computed, null, 2));
    var style_computed_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-computed.json'));
    t.deepEqual(style_computed, style_computed_expected);

    t.end();
});

function JSONize(obj) {
    return JSON.parse(JSON.stringify(obj));
}
