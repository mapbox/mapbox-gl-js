'use strict';

var Geometry = require('../geometry/geometry.js');
var Bucket = require('../geometry/bucket.js');
var FeatureTree = require('../geometry/featuretree.js');
var Protobuf = require('pbf');
var VectorTile = require('../format/vectortile.js');
var VectorTileFeature = require('../format/vectortilefeature.js');
var Placement = require('../text/placement.js');
var Loader = require('../text/loader.js');
var Shaping = require('../text/shaping.js');

// if (typeof self.console === 'undefined') {
//     self.console = require('./console.js');
// }

var actor = require('./worker.js');

/*
 * Request a resources as an arraybuffer
 *
 * @param {string} url
 * @param {function} callback
 */
function loadBuffer(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(null, xhr.response);
        } else {
            callback(xhr.statusText);
        }
    };
    xhr.send();
    return xhr;
}

module.exports = WorkerTile;
function WorkerTile(url, id, zoom, tileSize, template, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;
    this.tileSize = tileSize;
    this.template = template;

    WorkerTile.loading[id] = loadBuffer(url, function(err, data) {
        delete WorkerTile.loading[id];
        if (err) {
            callback(err);
        } else {
            WorkerTile.loaded[id] = tile;
            tile.data = new VectorTile(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, callback);
        }
    });
}

WorkerTile.cancel = function(id) {
    if (WorkerTile.loading[id]) {
        WorkerTile.loading[id].abort();
        delete WorkerTile.loading[id];
    }
};

// Stores tiles that are currently loading.
WorkerTile.loading = {};

// Stores tiles that are currently loaded.
WorkerTile.loaded = {};

// Stores the style information.
WorkerTile.buckets = {};

/*
 * Sorts features in a layer into different buckets, according to the maping
 *
 * Layers in vector tiles contain many different features, and feature types,
 * e.g. the landuse layer has parks, industrial buildings, forests, playgrounds
 * etc. However, when styling, we need to separate these features so that we can
 * render them separately with different styles.
 *
 * @param {VectorTileLayer} layer
 * @param {Mapping} mapping
 */
function sortFeaturesIntoBuckets(layer, mapping) {
    var buckets = {};

    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);
        for (var key in mapping) {
            // Filter features based on the filter function if it exists.
            if (!mapping[key].fn || mapping[key].fn(feature)) {

                // Only load features that have the same geometry type as the bucket.
                var type = VectorTileFeature.mapping[feature._type];
                if (type === mapping[key].filter.feature_type || mapping[key][type]) {
                    if (!(key in buckets)) buckets[key] = [];
                    buckets[key].push(feature);
                }
            }
        }
    }

    return buckets;
}

WorkerTile.prototype.parseBucket = function(bucket_name, features, info, faces, layer, callback) {
    var geometry = this.geometry;

    var bucket = new Bucket(info, geometry, this.placement);


    if (info.text) {
        this.parseTextBucket(features, bucket, info, faces, layer, done);
    } else {
        bucket.start();
        for (var i = 0; i < features.length; i++) {
            var feature = features[i];
            bucket.addFeature(feature.loadGeometry());

            this.featureTree.insert(feature.bbox(), bucket_name, feature);
        }
        bucket.end();
        setTimeout(done, 0);
    }

    function done(err) {
        callback(err, bucket);
    }
};

WorkerTile.prototype.parseTextBucket = function(features, bucket, info, faces, layer, callback) {
    var tile = this;

    // TODO: currently hardcoded to use the first font stack.
    // Get the list of shaped labels for this font stack.
    var stack = Object.keys(layer.shaping)[0];
    var shapingDB = layer.shaping[stack];
    if (!shapingDB) return;

    //console.time('placement');
    var text_features = [];

    var glyphStops = [
        128, // Basic Latin
        256, // Latin-1 Supplement
        384, // Latin Extended-A
        592, // Latin Extended-B
        688, // IPA Extensions
        768, // Spacing Modifier Letters
        880, // Combining Diacritical Marks
        1024, // Greek
        1280, // Cyrillic
        1424, // Armenian
        1536, // Hebrew
        1792, // Arabic
        1872, // Syriac
        1984, // Thaana
        2432, // Devanagari
        2560, // Bengali
        2688, // Gurmukhi
        2816, // Gujarati
        2944, // Oriya
        3072, // Tamil
        3200, // Telugu
        3328, // Kannada
        3456, // Malayalam
        3584, // Sinhala
        3712, // Thai
        3840, // Lao
        4096, // Tibetan
        4256, // Myanmar
        4352, // Georgian
        4608, // Hangul Jamo
        4992, // Ethiopic
        5120, // Cherokee
        5760, // Unified Canadian Aboriginal Syllabics
        5792, // Ogham
        5888, // Runic
        6144, // Khmer
        6320, // Mongolian
        7936, // Latin Extended Additional
        8192, // Greek Extended
        8304, // General Punctuation
        8352, // Superscripts and Subscripts
        8400, // Currency Symbols
        8448, // Combining Marks for Symbols
        8528, // Letterlike Symbols
        8592, // Number Forms
        8704, // Arrows
        8960, // Mathematical Operators
        9216, // Miscellaneous Technical
        9280, // Control Pictures
        9312, // Optical Character Recognition
        9472, // Enclosed Alphanumerics
        9600, // Box Drawing
        9632, // Block Elements
        9728, // Geometric Shapes
        9984, // Miscellaneous Symbols
        10176, // Dingbats
        10496, // Braille Patterns
        12032, // CJK Radicals Supplement
        12256, // Kangxi Radicals
        12288, // Ideographic Description Characters
        12352, // CJK Symbols and Punctuation
        12448, // Hiragana
        12544, // Katakana
        12592, // Bopomofo
        12688, // Hangul Compatibility Jamo
        12704, // Kanbun
        12736, // Bopomofo Extended
        13056, // Enclosed CJK Letters and Months
        13312, // CJK Compatibility
        19894, // CJK Unified Ideographs Extension A
        40960, // CJK Unified Ideographs
        42128, // Yi Syllables
        42192, // Yi Radicals
        55204, // Hangul Syllables
        56192, // High Surrogates
        56320, // High Private Use Surrogates
        57344, // Low Surrogates
        63744, // Private Use
        64256, // CJK Compatibility Ideographs
        64336, // Alphabetic Presentation Forms
        65024, // Arabic Presentation Forms-A
        65072, // Combining Half Marks
        65104, // CJK Compatibility Forms
        65136, // Small Form Variants
        65279, // Arabic Presentation Forms-B
        65280, // Specials
        65520, // Halfwidth and Fullwidth Forms
        65534 // Specials
    ];

    var fontstack = info['text-font'],
        ranges = [],
        codepoints = [],
        codepoint,
        glyphStopIndex,
        prevGlyphStop,
        rangeMin,
        rangeMax,
        range;

    var feature;
    for (var i = 0; i < features.length; i++) {
        feature = features[i];

        var text = feature[info['text-field']];
        if (!text) continue;

        for (var j = 0; j < text.length; j++) {
            codepoint = text.charCodeAt(j);
            if (codepoints.indexOf(codepoint) === -1) codepoints.push(codepoint);
        }

        // Track indexes of features with text.
        text_features.push(i);
    }

    for (var k = 0; k < codepoints.length; k++) {
        codepoint = codepoints[k];

        if (!isNaN(glyphStopIndex)) {
            prevGlyphStop = glyphStops[glyphStopIndex - 1] - 1 || -1;

            if (codepoint > prevGlyphStop && 
                codepoint < glyphStops[glyphStopIndex]) {
                // Range matches previous codepoint.
                continue;
            }
        } 

        for (var m = 0; m < glyphStops.length; m++) {
            if (codepoint < glyphStops[m]) {
                // Cache matching glyphStops index.
                glyphStopIndex = m;

                // Beginning of the glyph range
                rangeMin = glyphStops[m - 1] || 0;

                // End of the glyph range
                rangeMax = glyphStops[m] - 1;

                // Range string.
                range = rangeMin + '-' + rangeMax;

                // Add to glyph ranges if not already present.
                if (ranges.indexOf(range) === -1) {
                    ranges.push(range);
                }

                break;
            }
        }
    }

    Loader.whenLoaded(tile, fontstack, ranges, function(err) {
        if (err) callback(err);

        var stacks = {};
        stacks[fontstack] = {};
        stacks[fontstack].glyphs = codepoints.reduce(function(obj, codepoint) {
            obj[codepoint] = Loader.stacks[fontstack].glyphs[codepoint];
            return obj;
        }, {});

        actor.send('add glyphs', {
            id: tile.id,
            stacks: stacks
        }, function(err, rects) {
            if (err) callback(err);

            // Merge the rectangles of the glyph positions into the face object
            for (var name in rects) {
                if (!stacks[name]) stacks[name] = {};
                stacks[name].rects = rects[name];
            }

            bucket.start();
            for (var k = 0; k < text_features.length; k++) {
                feature = features[text_features[k]];
                var shaping = Shaping.shape(feature.name, fontstack, rects);
                if (!shaping) continue;
                var lines = feature.loadGeometry();
                bucket.addFeature(lines, stacks, shaping);
            }
            bucket.end();

            callback();
        });
    });
};

var geometryTypeToName = [null, 'point', 'line', 'fill'];

function getGeometry(feature) {
    return feature.loadGeometry();
}

function getType(feature) {
    return geometryTypeToName[feature._type];
}

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(tile, callback) {
    var self = this;
    var buckets = WorkerTile.buckets;
    var layers = {};

    this.geometry = new Geometry();
    this.placement = new Placement(this.geometry, this.zoom, this.tileSize);
    this.featureTree = new FeatureTree(getGeometry, getType);

    // Find all layers that we need to pull information from.
    var sourceLayers = {},
        layerName;

    for (var bucket in buckets) {
        layerName = buckets[bucket].filter.layer;
        if (!sourceLayers[layerName]) sourceLayers[layerName] = {};
        sourceLayers[layerName][bucket] = buckets[bucket];
    }

    var remaining = 0;

    for (layerName in sourceLayers) {
        var layer = tile.layers[layerName];
        if (!layer) continue;

        var featuresets = sortFeaturesIntoBuckets(layer, sourceLayers[layerName]);

        // Build an index of font faces used in this layer.
        var faceIndex = [];
        for (var i = 0; i < layer.faces.length; i++) {
            faceIndex[i] = tile.faces[layer.faces[i]];
        }

        // All features are sorted into buckets now. Add them to the geometry
        // object and remember the position/length
        for (var key in featuresets) {
            var features = featuresets[key];
            var info = buckets[key];
            if (!info) {
                alert("missing bucket information for bucket " + key);
            } else {
                remaining++;
                self.parseBucket(key, features, info, faceIndex, layer, layerDone(key));
            }
        }
    }

    function layerDone(key) {
        return function (err, bucket) {
            remaining--;
            if (err) return; // TODO how should this be handled?
            layers[key] = bucket;
            if (!remaining) done();
        };
    }

    function done() {
        // Collect all buffers to mark them as transferable object.
        var buffers = self.geometry.bufferList();

        // Convert buckets to a transferable format
        var bucketJSON = {};
        for (var b in layers) bucketJSON[b] = layers[b].toJSON();

        callback(null, {
            geometry: self.geometry,
            buckets: bucketJSON
        }, buffers);

        // we don't need anything except featureTree at this point, so we mark it for GC
        self.geometry = null;
        self.placement = null;
    }
};
