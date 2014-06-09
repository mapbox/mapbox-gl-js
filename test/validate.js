var t = require('tape'),
    path = require('path'),
    glob = require('glob'),
    fs = require('fs'),
    validate = require('../lib/validate');

var UPDATE = !!process.env.UPDATE;

t('style validity', function(t) {
    glob.sync(__dirname + '/fixture/*.input.json').forEach(function(file) {
        t.test(file, function(t) {
            var outputfile = file.replace('.input', '.output');
            var style = fs.readFileSync(file);
            var result = validate(style);
            if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
            var expect = JSON.parse(fs.readFileSync(outputfile));
            t.deepEqual(result, expect);
            t.end();
        });
    });
    t.end();
});
