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

    t.doesNotThrow(function() {
        require('./');
    }, 'can be used as a module');

    t.ok(function() {
        require('./').latest;
    }, 'latest spec on module');

    t.end();
});
