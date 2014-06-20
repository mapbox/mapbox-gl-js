'use strict';

var ref = require('../lib/reference')('v3');

module.exports = function upgrade(v2) {
    return converter(v2);
};

function converter(v2) {
    var v3 = {
        version: 3
    };

    if (v2.sprite) {
        v3.sprite = v2.sprite;
    }

    if (v2.constants) {
        v3.constants = {};
        for (var k in v2.constants) {
            v3.constants[(k.charAt(0) !== '@' ? '@' : '') + k] = v2.constants[k];
        }
    }

    if (v2.sources) {
        v3.sources = v2.sources;
    }

    var memo = {};

    v3.layers = v2.layers.map(function(layer) {
        return convertLayer(memo, layer, v2.buckets||{}, v2.styles||{}, v2.constants||{});
    });

    return v3;
}

function convertLayer(memo, v2, buckets, styles, constants) {
    var j, k, val, known;
    var v3 = {};
    v3.id = v2.id;

    // This is a composite layer. Recurse.
    if (v2.layers) {
        v3.layers = v2.layers.map(function(layer) {
            return convertLayer(memo, layer, buckets, styles, constants);
        });
    // This layer's bucket has not been established yet. Do so.
    } else if (v2.bucket && !memo[v2.bucket]) {
        memo[v2.bucket] = v2.id;

        var bucket = buckets[v2.bucket];
        if (!bucket) throw new Error('bucket not found for layer ' + v2.id);

        // Migrate bucket.filter.
        if (bucket.filter) for (k in bucket.filter) {
            if (k === 'source') {
                v3.source = bucket.filter[k];
            } else if (k === 'layer') {
                v3['source-layer'] = bucket.filter[k];
            } else if (k === 'feature_type') {
                v3.filter = v3.filter || {};
                v3.filter.$type = bucket.filter[k] === 'fill' ? 'polygon' : bucket.filter[k];
            } else {
                v3.filter = v3.filter || {};
                v3.filter[k] = bucket.filter[k];
            }
        }
        // Migrate bucket properties.
        for (k in bucket) {
            if (k === 'filter') continue;
            val = bucket[k];
            v3.render = v3.render || {};

            // specific migrations.
            if (k === 'point-size') {
                k = 'icon-size';
                v3.render[k] = Array.isArray(val) ? val[0] : val;
                continue;
            }

            if (/^(fill|line|point|text|raster|composite)$/.test(k)) {
                v3.render.type = k === 'point' ? 'icon' : k;
                continue;
            }

            k = k.replace('point-','icon-');
            known = false;
            for (j = 0; j < ref.render.length; j++) {
                known = known || (!!ref[ref.render[j]][k]);
            }
            if (!known) {
                console.warn('Skipping unknown render property %s', k);
                continue;
            }

            v3.render[k] = val;
        }
    } else if (v2.bucket) {
        v3.ref = memo[v2.bucket];
    }

    var background = false;
    if (v3.id === 'background') {
        v3.render = { type: 'background' };
        background = true;
    }

    for (var className in styles) {
        if (!styles[className][v2.id]) continue;
        var styleName = className === 'default' ? 'style' : 'style.' + className;
        for (k in styles[className][v2.id]) {
            val = styles[className][v2.id][k];
            val = typeof constants[val] !== 'undefined' ? '@' + val : val;
            v3[styleName] = v3[styleName] || {};

            // specific migrations.
            if (k === 'point-alignment') {
                k = 'icon-rotate-anchor';
                v3[styleName][k] = val !== 'screen' ? 'map' : 'viewport';
                continue;
            }
            if (k === 'stroke-color') {
                k = 'fill-outline-color';
                v3[styleName][k] = val;
                continue;
            }
            // composite styles
            if (k === 'opacity') {
                k = 'composite-opacity';
                v3.render = { type: 'composite' };
                v3[styleName][k] = val;
                continue;
            }
            if (k === 'transition-opacity') {
                k = 'transition-composite-opacity';
                v3.render = { type: 'composite' };
                v3[styleName][k] = val;
                continue;
            }

            k = k.replace('point-','icon-');
            if (background) k = k.replace('fill-', 'background-');
            known = false;
            for (j = 0; j < ref['class'].length; j++) {
                known = known || (!!ref[ref['class'][j]][k]);
            }
            if (!known) {
                console.warn('Skipping unknown class property %s', k);
                continue;
            }
            v3[styleName][k] = val;
        }
    }

    return v3;
}

