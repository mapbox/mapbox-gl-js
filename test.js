var test = require('tap').test,
    fs = require('fs');

test('reference', function(t) {
    var ref, parsed;

    t.doesNotThrow(function() {
        ref = fs.readFileSync('./reference/latest-style-raw.json');
    }, 'style exists');

    t.doesNotThrow(function() {
        parsed = JSON.parse(ref);
    }, 'can be parsed');

    t.end();
});
