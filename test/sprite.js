'use strict';

var test = require('tape'),
    fs = require('fs'),
    path = require('path'),
    createSprite = require('../').createSprite;

function is2x(f) { return f.match(/@2x/); }
function not(f) { return function(x) { return !f(x); }; }

test('createSprite', function(t) {
    var makiPath = path.join(__dirname, '/images/maki/'),
        maki = fs.readdirSync(makiPath)
            .filter(not(is2x))
            .map(function(f) {
                return path.join(makiPath, f);
            });
    createSprite(maki, 1, function(err, metadata, image) {
        t.notOk(err, 'no error');
        t.ok(metadata, 'metadata');
        t.ok(image, 'image');
        var fixturePath = path.join(__dirname, '/images/maki.output.json');
        if (process.env.UPDATE) fs.writeFileSync(fixturePath, JSON.stringify(metadata, null, 2));
        t.deepEqual(require(fixturePath), metadata);
        t.end();
    });
});

test('createSprite 2x', function(t) {
    var makiPath = path.join(__dirname, '/images/maki/'),
        maki = fs.readdirSync(makiPath)
            .filter(is2x)
            .map(function(f) {
                return path.join(makiPath, f);
            });
    createSprite(maki, 2, function(err, metadata, image) {
        t.notOk(err, 'no error');
        t.ok(metadata, 'metadata');
        t.ok(image, 'image');
        var fixturePath = path.join(__dirname, '/images/maki.output-2.json');
        if (process.env.UPDATE) fs.writeFileSync(fixturePath, JSON.stringify(metadata, null, 2));
        t.deepEqual(require(fixturePath), metadata);
        t.end();
    });
});
