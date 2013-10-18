importScripts('/gl/js/lib/underscore.js',
              '/gl/js/protobuf.js',
              '/gl/js/util.js',
              '/gl/js/vectortile.js',
              '/gl/js/fillbuffer.js',
              '/gl/js/vertexbuffer.js',
              '/gl/js/geometry.js');

addEventListener('message', function(e) {
    var data = e.data;
    var callback;
    if (typeof data.id !== 'undefined') {
        var id = data.id;
        callback = function(err, data, buffers) {
            postMessage({
                type: '<response>',
                id: id,
                error: err ? String(err) : null,
                data: data
            }, buffers);
        };
    }

    self[data.type](data.data, callback);
}, false);


function send(type, error, data, buffers) {
    postMessage({ type: type, error: error, data: data }, buffers);
}

// Debug
// if (typeof console === 'undefined') {
    console = {};
    console.log = console.warn = function() {
        send('debug', null, _.toArray(arguments));
    };
// }

if (typeof alert === 'undefined') {
    alert = function() {
        send('alert', null, _.toArray(arguments));
    };
}


// Stores the style information.
var style = {};

// Stores tiles that are currently loading.
var loading = {};


/*
 * Updates the style to use for this map.
 *
 * @param {Style} data
 */
self['set style'] = function(data) {
    style = data;
};


/*
 * Load and parse a tile at `url`, and call `callback` with
 * (err, response)
 *
 * @param {string} url
 * @param {function} callback
 */
self['load tile'] = function(url, callback) {
    loading[url] = loadBuffer(url, function(err, buffer) {
        delete loading[url];
        if (err) {
            callback(err);
        } else {
            parseTile(buffer, callback);
        }
    });
};

/*
 * Abort the request keyed under `url`
 *
 * @param {string} url
 */
self['abort tile'] = function(url) {
    if (loading[url]) {
        loading[url].abort();
        delete loading[url];
    }
};

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
    xhr.onload = function(e) {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(null, xhr.response);
        } else {
            callback(xhr.statusText);
        }
    };
    xhr.send();
    return xhr;
}

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
    for (var key in mapping.sort) {
        buckets[key] = [];
    }

    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);
        for (key in mapping.sort) {
            if (mapping.sort[key] === true ||
                mapping.sort[key].indexOf(feature[mapping.field]) >= 0) {
                buckets[key].push(feature);
                break;
            }
        }
    }

    return buckets;
}

function parseBucket(features, info, layer, geometry) {
    // Remember starting indices of the geometry buffers.
    var bucket = {
        buffer: geometry.bufferIndex,
        vertexIndex: geometry.vertex.index,
        fillIndex: geometry.fill.index
    };

    if (info.type == "text") {
        parseTextBucket(features, bucket, info, layer, geometry);
    } else if (info.type == "point" && info.marker) {
        parseMarkerBucket(features, bucket, info, layer, geometry);
    } else {
        parseShapeBucket(features, bucket, info, layer, geometry);
    }

    bucket.bufferEnd = geometry.bufferIndex;
    bucket.vertexIndexEnd = geometry.vertex.index;
    bucket.fillIndexEnd = geometry.fill.index;

    return bucket;
}

function parseTextBucket(features, bucket, info, layer, geometry) {
    bucket.labels = [];

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        // TODO: Better text placement
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            bucket.labels.push({ text: feature[info.field], vertices: lines[j] });
        }
    }

    bucket.shaping = layer.shaping;
    bucket.faces = layer.faces;
}

function parseMarkerBucket(features, bucket, info, layer, geometry) {
    var spacing = info.spacing || 100;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addMarkers(lines[j], spacing);
        }
    }
}

function parseShapeBucket(features, bucket, info, layer, geometry) {
    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addLine(lines[j], info.join, info.cap, info.miterLimit, info.roundLimit);
        }
    }
}

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
function parseTile(data, callback) {
    var tile = new VectorTile(new Protobuf(new Uint8Array(data)));
    var layers = {};
    var geometry = new Geometry();

    var mappings = style.mapping;
    for (var k = 0; k < mappings.length; k++) {
        var mapping = mappings[k];
        var layer = tile.layers[mapping.layer];
        if (!layer) continue;

        var buckets = sortFeaturesIntoBuckets(layer, mapping);

        // All features are sorted into buckets now. Add them to the geometry
        // object and remember the position/length
        for (var key in buckets) {
            var features = buckets[key];
            var info = style.buckets[key];
            if (!info) {
                alert("missing bucket information for bucket " + key);
                continue;
            }

            layers[key] = parseBucket(features, info, layer, geometry);
        }
    }

    // Collect all buffers to mark them as transferable object.
    var buffers = [ data ];
    for (var l = 0; l < geometry.buffers.length; l++) {
        buffers.push(geometry.buffers[l].fill.array, geometry.buffers[l].vertex.array);
    }

    callback(null, {
        geometry: geometry,
        layers: layers,
        faces: tile.faces
    }, buffers);
}
