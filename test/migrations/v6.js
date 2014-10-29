'use strict';

var t = require('tape'),
    migrate = require('../../migrations/v6');

t('render ⇢ layout', function(t) {
    t.deepEqual(migrate({
        "version": 6,
        "layers": [{
            "render": {}
        }]
    }), {
        "version": 6,
        "layers": [{
            "layout": {}
        }]
    });
    t.end();
});

t('style ⇢ paint', function(t) {
    t.deepEqual(migrate({
        "version": 6,
        "layers": [{
            "style": {},
            "style.class": {}
        }]
    }), {
        "version": 6,
        "layers": [{
            "paint": {},
            "paint.class": {}
        }]
    });
    t.end();
});
