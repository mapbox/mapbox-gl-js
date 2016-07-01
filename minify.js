#!/usr/bin/env node

'use strict';

function replacer(k,v) {
    return (k === 'doc' || k === 'example' || k === 'sdk-support') ? undefined : v;
}

var glob = require('glob'),
    path = require('path'),
    rw = require('rw');

var files = glob.sync(path.join(__dirname, 'reference/*.json'));
files.forEach(function(file) {
    if (file.match(/.min.json/i) !== null) return;
    rw.writeFileSync(file.replace(/.json/i, '.min.json'),
        JSON.stringify(JSON.parse(rw.readFileSync(file)), replacer, 0)
    );
});
