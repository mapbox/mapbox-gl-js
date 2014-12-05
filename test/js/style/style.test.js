'use strict';

var test = require('tape');
var fs = require('fs');

require('../../bootstrap');

var AnimationLoop = require('../../../js/style/animation_loop');
var Style = require('../../../js/style/style');
var stylesheet = require('../../fixtures/style-basic.json');
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
    t.deepEqual(style.layerGroups[1].source, undefined);

    // computed
    var style_computed = JSON.parse(JSON.stringify(style.computed));
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-computed.json', JSON.stringify(style_computed, null, 2));
    var style_computed_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-computed.json'));
    t.deepEqual(style_computed, style_computed_expected);

    style.addClass('night');
    t.ok(style.hasClass('night'));

    style.removeClass('night');
    t.ok(!style.hasClass('night'));

    t.end();
});
