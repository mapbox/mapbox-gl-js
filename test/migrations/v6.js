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

t('text-anchor', function(t) {
    t.deepEqual(migrate({
        "version": 6,
        "layers": [{
            "layout": {
                "text-horizontal-align": "center",
                "text-vertical-align": "center"
            }
        }, {
            "layout": {
                "text-horizontal-align": "left"
            }
        }, {
            "layout": {
                "text-horizontal-align": "right"
            }
        }, {
            "layout": {
                "text-vertical-align": "top"
            }
        }, {
            "layout": {
                "text-vertical-align": "bottom"
            }
        }]
    }), {
        "version": 6,
        "layers": [{
            "layout": {
                "text-anchor": "center"
            }
        }, {
            "layout": {
                "text-anchor": "left"
            }
        }, {
            "layout": {
                "text-anchor": "right"
            }
        }, {
            "layout": {
                "text-anchor": "top"
            }
        }, {
            "layout": {
                "text-anchor": "bottom"
            }
        }]
    });
    t.end();
});
