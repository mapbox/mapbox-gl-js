var t = require('tape'),
    path = require('path');
    fs = require('fs');


t('reference validity', function(t) {
    var ref = require('mapbox-gl-style-spec').latest;
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
