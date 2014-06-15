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

    t.ok(require('./').latest, 'latest spec on module');

    t.ok(require('./').v2, 'v2 spec on module');

    t.end();
});

test('valid reference raw', function(t) {
    var ref = require('./').latest;
    for (var k in ref) {
        // Exception for version.
        if (k === 'version') {
        } else {
            validSchema(k, t, ref[k], ref);
        }
    }
    t.end();
});

test('valid reference v2', function(t) {
    var ref = require('./').v2;
    for (var k in ref) {
        // Exception for version.
        if (k === '$version') {
        } else {
            validSchema(k, t, ref[k], ref);
        }
    }
    t.end();
});


function validSchema(k, t, obj, ref) {
    var scalar = ['boolean','string','number','constant'];
    var types = Object.keys(ref).concat(['boolean','string','number','constant','array','color','*']);
    var keys = [
        'default',
        'default-value',
        'doc',
        'function',
        'length',
        'required',
        'transition',
        'type',
        'value',
        'values'
    ];

    // Schema object.
    if (Array.isArray(obj.type) || typeof obj.type === 'string') {
        // schema must have only known keys
        for (var attr in obj)
            t.ok(keys.indexOf(attr) !== -1, k + '.' + attr);

        // schema type is an enum, its members must be scalars
        if (Array.isArray(obj.type)) {
            t.ok(obj.type.every(function(v) {
                return scalar.indexOf(typeof v) !== -1;
            }), k + '.type [' + obj.type +']');
        // schema type must be js native, 'color', or present in ref root object.
        } else {
            t.ok(types.indexOf(obj.type) !== -1, k + '.type (' + obj.type + ')');
        }
        if (obj.value !== undefined)
            t.ok(types.indexOf(obj.value) !== -1, k + '.value (' + obj.value + ')');

        // schema key type checks
        if (obj.doc !== undefined)
            t.equal('string', typeof obj.doc, k + '.doc (string)');
        if (obj.function !== undefined)
            t.equal('boolean', typeof obj.function, k + '.function (boolean)');
        if (obj.required !== undefined)
            t.equal('boolean', typeof obj.required, k + '.required (boolean)');
        if (obj.transition !== undefined)
            t.equal('boolean', typeof obj.transition, k + '.transition (boolean)');
    // Array of schema objects or references.
    } else if (Array.isArray(obj)) {
        obj.forEach(function(child, j) {
            if (typeof child === 'string' && scalar.indexOf(child) !== -1) return;
            validSchema(k + '[' + j + ']', t,  typeof child === 'string' ? ref[child] : child, ref);
        });
    // Container object.
    } else if (typeof obj === 'object') {
        for (var j in obj) validSchema(k + '.' + j, t, obj[j], ref);
    // Invalid ref object.
    } else {
        t.ok(false, 'Invalid: ' + k);
    }
}

