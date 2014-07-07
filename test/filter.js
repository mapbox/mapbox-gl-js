'use strict';
var t = require('tape'),
filter = require('../lib/filter');

t('filter validity', function(t) {
    t.ok(filter({foo: 'bar', bar: 5}));
    t.ok(filter({
        '||': [
            {'foo': {'<': 5}},
            {'bar': 'baz'}
        ]
    }));

    t.ok(filter({
        'foo': {'$exists': true}
    }));

    t.ok(filter({
        'foo': {'$exists': true}
    }, []));

    t.ok(filter({
        '!': {
            'foo': {'<': 5},
            'bar': 'baz'
        }
    }));

    t.notOk(filter({
        '?': {
            'foo': {'<': 5},
            'bar': 'baz'
        }
    }));

    t.ok(filter(null));

    t.ok(filter({
        'bogusoperator': [
            {'foo': {'<': 5}},
            {'bar': 'baz'}
        ]
    }));
    t.end();
});

