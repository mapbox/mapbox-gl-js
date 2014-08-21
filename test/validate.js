/* global process, __dirname */
'use strict';

var t = require('tape'),
    glob = require('glob'),
    fs = require('fs'),
    validate = require('../').v2;

var UPDATE = !!process.env.UPDATE;

t('style validity', function(t) {
    glob.sync(__dirname + '/fixture/*.input.json').forEach(function(file) {
        t.test(file, function(t) {
            var outputfile = file.replace('.input', '.output');
            var style = fs.readFileSync(file);
            var result = validate(style);

            // Put it through the wringer to strip keys for undefined line errors.
            result = JSON.parse(JSON.stringify(result));

            if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
            var expect = JSON.parse(fs.readFileSync(outputfile));
            t.deepEqual(result, expect);
            t.end();
        });
    });
    t.end();
});
