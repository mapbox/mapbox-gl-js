var t = require('tape'),
    path = require('path');
    fs = require('fs');

var reference = fs.readFileSync(path.resolve(path.join(__dirname,
    '../reference/latest-style-raw.json')), 'utf8');

t('reference validity', function(t) {
    t.doesNotThrow(function() {
        JSON.parse(reference);
    });
    var ref = JSON.parse(reference);
    t.ok(ref.version, 'version');
    for (var s in ref.style) {
        t.ok(ref.style[s].type, s);
    }
    for (s in ref.bucket) {
        t.ok(ref.bucket[s].type, s);
    }
    for (s in ref.bucket_filter) {
        t.ok(ref.bucket_filter[s].type, s);
    }
    t.end();
});
