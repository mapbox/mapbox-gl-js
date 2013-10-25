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
    new WorkerTile(params.url, params.id, params.zoom, callback);
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


function WorkerTile(url, id, zoom, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;

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

    // Calculate the maximum scale we can go down in our fake-3d rtree so that
    // placement still makes sense. This is calculated so that the minimum
    // placement zoom can be at most 25.5 (we use an unsigned integer x10 to
    // store the minimum zoom).
    var maxPlacementScale = Math.exp(Math.LN2 * (25.5 - this.zoom));

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
                    length: Infinity
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
            var fontScale = (4096 / 512) / (24 / info.fontSize);

            // Use the minimum scale from the place information. This shrinks the
            // bbox we query for immediately and we have less spurious collisions.
            var placementScale = 1;

            // The total text advance is the width of this label.
            var advance = this.measureText(faces, shaping);

            // Calculate the minimum placement scale we should start with based
            // on the length of the street segment.
            // TODO: extend the segment length if the adjacent segments are
            //       almost parallel to this segment.
            placementScale = Math.max(1, advance * fontScale * 1.1 / Math.sqrt(segment.length));
            if (placementScale > maxPlacementScale) {
                continue with_next_segment;
            }

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

                    // Calculate the rotated glyph's bounding box offsets from the
                    // anchor point.
                    var box = {
                        x1: fontScale * Math.min(tl.x, tr.x, bl.x, br.x),
                        y1: fontScale * Math.min(tl.y, tr.y, bl.y, br.y),
                        x2: fontScale * Math.max(tl.x, tr.x, bl.x, br.x),
                        y2: fontScale * Math.max(tl.y, tr.y, bl.y, br.y)
                    };

                    // TODO: Increase placementScale so that it doesn't intersect the tile boundary.

                    // Compute the rectangular outer bounding box of the rotated glyph.
                    var minPlacedX = anchor.x + box.x1 / placementScale;
                    var minPlacedY = anchor.y + box.y1 / placementScale;
                    var maxPlacedX = anchor.x + box.x2 / placementScale;
                    var maxPlacedY = anchor.y + box.y2 / placementScale;

                    // TODO: This is a hack to avoid placing labels across tile boundaries.
                    if (minPlacedX < 0 || maxPlacedX < 0 || minPlacedX > 4095 || maxPlacedX > 4096 ||
                        minPlacedY < 0 || maxPlacedY < 0 || minPlacedY > 4095 || maxPlacedY > 4096) {
                        continue with_next_segment;
                    }

                    var blocking = this.tree.search([ minPlacedX, minPlacedY, maxPlacedX, maxPlacedY ]);

                    if (blocking.length) {
                        // TODO: collission detection is not quite right yet.
                        // continue with_next_segment;

                        var na = anchor; // new anchor
                        var nb = box; // new box

                        for (var l = 0; l < blocking.length; l++) {
                            var oa = blocking[l].anchor; // old anchor
                            var ob = blocking[l].box; // old box

                            // If anchors are identical, we're going to skip the label.
                            // NOTE: this isn't right because there can be glyphs with
                            // the same anchor but differing box offsets.
                            if (na.x == oa.x && na.y == oa.y) {
                                continue with_next_segment;
                            }

                            // Original algorithm:
                            var s1 = (ob.x1 - nb.x2) / (na.x - oa.x); // scale at which new box is to the left of old box
                            var s2 = (ob.x2 - nb.x1) / (na.x - oa.x); // scale at which new box is to the right of old box
                            var s3 = (ob.y1 - nb.y2) / (na.y - oa.y); // scale at which new box is to the top of old box
                            var s4 = (ob.y2 - nb.y1) / (na.y - oa.y); // scale at which new box is to the bottom of old box
                            placementScale = Math.max(placementScale, Math.min(Math.max(s1, s2), Math.max(s3, s4)));

                            if (placementScale > maxPlacementScale) {
                                continue with_next_segment;
                            }
                        }

                    }

                    // Remember the glyph for later insertion.
                    glyphs.push({
                        tl: tl,
                        tr: tr,
                        bl: bl,
                        br: br,
                        tex: rect,
                        width: width,
                        height: height,
                        box: box
                    });
                }
            }

            var placementZoom = this.zoom + Math.log(placementScale) / Math.LN2;

            // Once we're at this point in the loop, we know that we can place the label
            // and we're going to insert all all glyphs we remembered earlier.
            for (var k = 0; k < glyphs.length; k++) {
                var glyph = glyphs[k];
                var tl = glyph.tl, tr = glyph.tr, bl = glyph.bl, br = glyph.br;
                var tex = glyph.tex, width = glyph.width, height = glyph.height;
                var box = glyph.box;

                // Insert glyph placements into rtree.
                this.tree.insert({
                    x1: anchor.x + box.x1 / placementScale,
                    y1: anchor.y + box.y1 / placementScale,
                    x2: anchor.x + box.x2 / placementScale,
                    y2: anchor.y + box.y2 / placementScale,

                    anchor: anchor,
                    box: box
                });

                // first triangle
                glyphVertex.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, angle, placementZoom);
                glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, placementZoom);
                glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, placementZoom);

                // second triangle
                glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, placementZoom);
                glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, placementZoom);
                glyphVertex.add(anchor.x, anchor.y, br.x, br.y, tex.x + width, tex.y + height, angle, placementZoom);
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
