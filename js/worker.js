importScripts('/gl/js/actor.js',
              '/gl/js/protobuf.js',
              '/gl/js/vectortile.js',
              '/gl/js/util.js',
              '/gl/js/lib/rbush.js',
              '/gl/js/fillbuffer.js',
              '/gl/js/vertexbuffer.js',
              '/gl/js/glyphvertexbuffer.js',
              '/gl/js/geometry.js');

var actor = new Actor(self, self);

// Debug
// if (typeof console === 'undefined') {
    console = {};
    console.log = console.warn = function() {
        postMessage({ type: 'debug message', data: [].slice.call(arguments) });
    };
// }

if (typeof alert === 'undefined') {
    alert = function() {
        postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}


// Stores the style information.
var style = {};

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
self['load tile'] = function(params, callback) {
    new WorkerTile(params.url, params.id, callback);
};

/*
 * Abort the request keyed under `url`
 *
 * @param {string} url
 */
self['abort tile'] = function(url) {
    WorkerTile.cancel(url);
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


function WorkerTile(url, id, callback) {
    var tile = this;
    this.url = url;
    this.id = id;

    WorkerTile.loading[id] = loadBuffer(url, function(err, data) {
        delete WorkerTile.loading[id];
        if (err) {
            callback(err);
        } else {
            tile.parse(data, callback);
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
    var key, feature;
    for (var i = 0; i < layer.length; i++) {
        feature = layer.feature(i);
        for (key in mapping.sort) {
            if (mapping.sort[key] === true ||
                mapping.sort[key].indexOf(feature[mapping.field]) >= 0) {
                if (!(key in buckets)) buckets[key] = [];
                buckets[key].push(feature);
                break;
            }
        }
    }

    return buckets;
}

WorkerTile.prototype.parseBucket = function(features, info, faces, layer, callback) {
    var geometry = this.geometry;

    // Remember starting indices of the geometry buffers.
    var bucket = {
        info: info,
        buffer: geometry.bufferIndex,
        vertexIndex: geometry.vertex.index,
        fillIndex: geometry.fill.index
    };

    if (info.type == "text") {
        this.parseTextBucket(features, bucket, info, faces, layer, done);
    } else if (info.type == "point" && info.marker) {
        this.parseMarkerBucket(features, bucket, info, faces, layer, done);
    } else {
        this.parseShapeBucket(features, bucket, info, faces, layer, done);
    }

    function done() {
        bucket.bufferEnd = geometry.bufferIndex;
        bucket.vertexIndexEnd = geometry.vertex.index;
        bucket.fillIndexEnd = geometry.fill.index;
        callback(bucket);
    }
};

WorkerTile.prototype.parseTextBucket = function(features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;

    // TODO: currently hardcoded to use the first font stack.
    // Get the list of shaped labels for this font stack.
    var stack = Object.keys(layer.shaping)[0];
    var shapingDB = layer.shaping[stack];
    if (!shapingDB) return callback();

    var glyphVertex = geometry.glyph;

    bucket.glyphVertexIndex = glyphVertex.index;

    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var text = feature[info.field];
        if (!text) continue;
        var shaping = shapingDB[text];

        var segments = [];

        // Add the label for every line
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            var line = lines[j];

            // Place labels that only have one point.
            if (line.length === 1) {
                segments.push({
                    x1: line[0].x - 1,
                    y1: line[0].y,
                    x2: line[0].x + 1,
                    y2: line[0].y,
                    length: 2
                });
            } else {
                // Make a list of all line segments in this
                var prev = line[0];
                for (var k = 1; k < line.length; k++) {
                    var current = line[k];
                    segments.push({
                        x1: prev.x,
                        y1: prev.y,
                        x2: current.x,
                        y2: current.y,
                        length: distance_squared(prev, current)
                    });
                    prev = current;
                }
            }
        }

        // Sort line segments by length so that we can start placement at
        // the longest line segment.
        segments.sort(function(a, b) {
            return b.length - a.length;
        });

    with_next_segment:
        for (var j = 0; j < segments.length; j++) {
            var segment = segments[j];

            // TODO: set minimum placement scale so that it is far enough away from an existing label with the same name
            // This avoids repetive labels, e.g. on bridges or roads with multiple carriage ways.

            // street label size is 12 pixels, sdf glyph size is 24 pixels.
            // the minimum map tile size is 512, the extent is 4096
            // this value is calculated as: (4096/512) / (24/12)
            var fontScale = 4;

            // Use the minimum scale from the place information. This shrinks the
            // bbox we query for immediately and we have less spurious collisions.
            var placementScale = 1;

            // The total text advance is the width of this label.
            var advance = this.measureText(faces, shaping);

            // Find the center of that line segment and define at as the
            // center point of the label. For that line segment, we can now
            // compute the angle of the label (and optionally invert it if the
            var a = { x: segment.x1, y: segment.y1 }, b = { x: segment.x2, y: segment.y2 };
            anchor = line_center(a, b);

            // Clamp to -90/+90 degrees
            var angle = -Math.atan2(b.x - a.x, b.y - a.y) + Math.PI / 2;
            angle = clamp_horizontal(angle);

            // Compute the transformation matrix.
            var sin = Math.sin(angle), cos = Math.cos(angle);
            var matrix = { a: cos, b: -sin, c: sin, d: cos };

            // TODO: figure out correct ascender height.
            var origin = { x: 0, y: -17 };

            // TODO: allow setting an alignment
            var alignment = 'center';
            if (alignment == 'center') {
                origin.x -= advance / 2;
            } else if (alignment == 'right') {
                origin.x -= advance;
            }


            var boxes = [];
            var glyphs = [];

            var scale = 1;
            var buffer = 3;

        with_next_glyph:
            for (var k = 0; k < shaping.length; k++) {
                var shape = shaping[k];
                var face = faces[shape.face];
                var glyph = face.glyphs[shape.glyph];
                var rect = face.rects[shape.glyph];

                if (!glyph) continue with_next_glyph;

                var width = glyph.width;
                var height = glyph.height;

                if (width > 0 && height > 0 && rect) {
                    width += buffer * 2;
                    height += buffer * 2;

                    // Increase to next number divisible by 4, but at least 1.
                    // This is so we can scale down the texture coordinates and pack them
                    // into 2 bytes rather than 4 bytes.
                    width += (4 - width % 4);
                    height += (4 - height % 4);

                    var x1 = origin.x + (shape.x + glyph.left - buffer) * scale;
                    var y1 = origin.y + (shape.y - glyph.top - buffer) * scale;

                    var x2 = x1 + width * scale;
                    var y2 = y1 + height * scale;

                    var tl = vectorMul(matrix, { x: x1, y: y1 });
                    var tr = vectorMul(matrix, { x: x2, y: y1 });
                    var bl = vectorMul(matrix, { x: x1, y: y2 });
                    var br = vectorMul(matrix, { x: x2, y: y2 });

                    // Compute the rectangular outer bounding box of the rotated glyph.
                    var outerBox = {
                        x1: anchor.x + fontScale * Math.min(tl.x, tr.x, bl.x, br.x),
                        y1: anchor.y + fontScale * Math.min(tl.y, tr.y, bl.y, br.y),
                        x2: anchor.x + fontScale * Math.max(tl.x, tr.x, bl.x, br.x),
                        y2: anchor.y + fontScale * Math.max(tl.y, tr.y, bl.y, br.y)
                    };

                    // TODO: This is a hack to avoid placing labels across tile boundaries.
                    if (outerBox.x1 < 0 || outerBox.x2 < 0 || outerBox.x1 > 4095 || outerBox.x2 > 4096 ||
                        outerBox.y1 < 0 || outerBox.y2 < 0 || outerBox.y1 > 4095 || outerBox.y2 > 4096) {
                        continue with_next_segment;
                    }

                    var blocking = this.tree.search([
                        outerBox.x1, outerBox.y1,
                        outerBox.x2, outerBox.y2
                    ]);

                    if (blocking.length) {
                        // TODO: increase zoom level.
                        continue with_next_segment;
                    } else {
                        boxes.push(outerBox);

                        // Remember the glyph for later insertion
                        glyphs.push({
                            tl: tl,
                            tr: tr,
                            bl: bl,
                            br: br,
                            tex: rect,
                            width: width,
                            height: height
                        });
                    }
                }
            }

            // Insert glyph placements into rtree.
            for (var k = 0; k < boxes.length; k++) {
                this.tree.insert(boxes[k]);
            }

            // Once we're at this point in the loop, we know that we can place the label
            // and we're going to insert all all glyphs we remembered earlier.
            for (var k = 0; k < glyphs.length; k++) {
                var glyph = glyphs[k];

                // first triangle
                glyphVertex.add(anchor.x, anchor.y, glyph.tl.x, glyph.tl.y, glyph.tex.x, glyph.tex.y, angle);
                glyphVertex.add(anchor.x, anchor.y, glyph.tr.x, glyph.tr.y, glyph.tex.x + glyph.width, glyph.tex.y, angle);
                glyphVertex.add(anchor.x, anchor.y, glyph.bl.x, glyph.bl.y, glyph.tex.x, glyph.tex.y + glyph.height, angle);

                // second triangle
                glyphVertex.add(anchor.x, anchor.y, glyph.tr.x, glyph.tr.y, glyph.tex.x + glyph.width, glyph.tex.y, angle);
                glyphVertex.add(anchor.x, anchor.y, glyph.bl.x, glyph.bl.y, glyph.tex.x, glyph.tex.y + glyph.height, angle);
                glyphVertex.add(anchor.x, anchor.y, glyph.br.x, glyph.br.y, glyph.tex.x + glyph.width, glyph.tex.y + glyph.height, angle);
            }
        }
    }

    // Remember the glyph
    bucket.glyphVertexIndexEnd = glyphVertex.index;

    callback();
};

WorkerTile.prototype.measureText = function(faces, shaping) {
    var advance = 0;

    // TODO: advance is not calculated correctly. we should instead use the
    // bounding box of the glyph placement.
    for (var i = 0; i < shaping.length; i++) {
        var shape = shaping[i];
        var glyph = faces[shape.face].glyphs[shape.glyph];
        if (glyph) {
            advance += glyph.advance;
        }
    }

    return advance;
};

WorkerTile.prototype.parseMarkerBucket = function(features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;
    var spacing = info.spacing || 100;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addMarkers(lines[j], spacing);
        }
    }

    callback();
};

WorkerTile.prototype.parseShapeBucket = function(features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addLine(lines[j], info.join, info.cap, info.miterLimit, info.roundLimit);
        }
    }

    callback();
};

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(data, callback) {
    var self = this;
    var tile = new VectorTile(new Protobuf(new Uint8Array(data)));
    var layers = {};

    // label placement
    this.tree = rbush(9, ['.x1', '.y1', '.x2', '.y2']);

    this.geometry = new Geometry();

    var mappings = style.mapping;

    actor.send('add glyphs', {
        id: self.id,
        faces: tile.faces
    }, function(err, rects) {
        if (err) {
            // Stop processing this tile altogether if we failed to add the glyphs.
            return;
        }

        // Merge the rectangles of the glyph positions into the face object
        for (var name in rects) {
            tile.faces[name].rects = rects[name];
        }

        async_each(mappings, function(mapping, callback) {
            var layer = tile.layers[mapping.layer];
            if (!layer) return callback();

            var buckets = sortFeaturesIntoBuckets(layer, mapping);

            // Build an index of font faces used in this layer.
            var face_index = [];
            for (var i = 0; i < layer.faces.length; i++) {
                face_index[i] = tile.faces[layer.faces[i]];
            }

            // All features are sorted into buckets now. Add them to the geometry
            // object and remember the position/length
            async_each(Object.keys(buckets), function(key, callback) {
                var features = buckets[key];
                var info = style.buckets[key];
                if (!info) {
                    alert("missing bucket information for bucket " + key);
                    return callback();
                }

                self.parseBucket(features, info, face_index, layer, function(bucket) {
                    layers[key] = bucket;
                    callback();
                });
            }, callback);
        }, function parseTileComplete() {
            // Collect all buffers to mark them as transferable object.
            var buffers = self.geometry.bufferList();

            callback(null, {
                geometry: self.geometry,
                layers: layers
            }, buffers);
        });
    });
}
