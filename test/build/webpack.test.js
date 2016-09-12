'use strict';

var webpack = require("webpack");
var test = require('tap').test;
var MemoryFS = require('memory-fs');
var util = require('../../js/util/util');

test('builds with webpack', function(t) {

    var compiler = webpack(util.extend(require('../../webpack.config.example'), {
        entry: './test/fixtures/webpack-entry.js',
        output: {
            path: '/',
            filename: 'webpack.js'
        }
    }));

    compiler.outputFileSystem = new MemoryFS();
    compiler.run(function(error, stats) {
        t.error(error);
        t.notOk(stats.hasErrors());
        t.notOk(stats.hasWarnings());
        t.ok(compiler.outputFileSystem.readFileSync('/webpack.js').toString());
        t.end();
    });

});
