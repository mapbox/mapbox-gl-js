'use strict';

var test = require('tape');
var fs = require('fs');
var st = require('st');
var http = require('http');

require('../../bootstrap');

var AnimationLoop = require('../../../js/style/animation_loop');
var Style = require('../../../js/style/style');
var Source = require('../../../js/source/source');
var stylesheet = require('../../fixtures/style-basic.json');
var UPDATE = process.env.UPDATE;

function createSource() {
    return new Source({
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        attribution: 'Mapbox',
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    });
}

test('Style', function(t) {
    var server = http.createServer(st({path: __dirname + '/../../fixtures'}));

    t.test('before', function(t) {
        server.listen(2900, t.end);
    });

    t.test('can be constructed from JSON', function(t) {
        var style = new Style(stylesheet);
        t.ok(style);
        t.end();
    });

    t.test('can be constructed from a URL', function(t) {
        var style = new Style("http://localhost:2900/style-basic.json");
        style.on('change', function() {
            t.end();
        });
    });

    t.test('creates sources', function(t) {
        var style = new Style(stylesheet);
        t.ok(style.getSource('mapbox.mapbox-streets-v5') instanceof Source);
        t.end();
    });

    t.test('after', function(t) {
        server.close(t.end);
    });
});

test('Style#addSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(stylesheet),
            source = createSource();
        t.equal(style.addSource('source-id', source), style);
        t.end();
    });

    t.test('fires source.add', function(t) {
        var style = new Style(stylesheet),
            source = createSource();
        style.on('source.add', function(e) {
            t.equal(e.source, source);
            t.end();
        });
        style.addSource('source-id', source);
    });

    t.test('throws on duplicates', function(t) {
        var style = new Style(stylesheet),
            source = createSource();
        style.addSource('source-id', source);
        t.throws(function() {
            style.addSource('source-id', source);
        }, /There is already a source with this ID/);
        t.end();
    });

    t.test('sets up source event forwarding', function(t) {
        var style = new Style(stylesheet),
            source = createSource();

        style.on('source.change', t.ok);
        style.on('tile.add',      t.ok);
        style.on('tile.load',     t.ok);
        style.on('tile.remove',   t.ok);

        style.addSource('source-id', source);

        t.plan(4);
        source.fire('change');
        source.fire('tile.add');
        source.fire('tile.load');
        source.fire('tile.remove');
    });
});

test('Style#removeSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(stylesheet),
            source = createSource();
        style.addSource('source-id', source);
        t.equal(style.removeSource('source-id'), style);
        t.end();
    });

    t.test('fires source.remove', function(t) {
        var style = new Style(stylesheet),
            source = createSource();
        style.on('source.remove', function(e) {
            t.equal(e.source, source);
            t.end();
        });
        style.addSource('source-id', source);
        style.removeSource('source-id');
    });

    t.test('throws on non-existence', function(t) {
        var style = new Style(stylesheet);
        t.throws(function() {
            style.removeSource('source-id');
        }, /There is no source with this ID/);
        t.end();
    });

    t.test('tears down source event forwarding', function(t) {
        var style = new Style(stylesheet),
            source = createSource();

        style.on('source.change', t.fail);
        style.on('tile.add',      t.fail);
        style.on('tile.load',     t.fail);
        style.on('tile.remove',   t.fail);

        style.addSource('source-id', source);
        style.removeSource('source-id');

        source.fire('change');
        source.fire('tile.add');
        source.fire('tile.load');
        source.fire('tile.remove');
        t.end();
    });
});

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
