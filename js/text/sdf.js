'use strict';

module.exports = glyphToSDF;

function glyphToSDF(glyph, scale, edgeDist, padding) {

    if (padding === undefined) padding = edgeDist;

    var width = Math.ceil((glyph.xMax - glyph.xMin) * scale + 2 * padding);
    var height = Math.ceil((glyph.yMax - glyph.yMin) * scale + 2 * padding);

    var valueScale = 2 << 20;

    var buffer = new ArrayBuffer(4 * width * height);
    var data = new Int32Array(buffer);
    var sdf = {
        data: data,
        buffer: buffer,
        glyph: glyph,
        width: width,
        height: height,
        edgeDist: edgeDist,
        padding: padding,
        valueScale: valueScale
    };

    for (var n = 0; n < data.length; n++) data[n] = -Math.pow(2, 31);

    var contours = glyph.getContours();

    for (var c = 0; c < contours.length; c++) {
        var contour = contours[c];

        contour = expand(contour);
        for (var i = 0; i < contour.length - 0; i++) {
            var start = contour[i];
            var end = contour[(i + 1) % contour.length];
            var third = contour[(i + 2) % contour.length];
            segmentSDF(start, end, third, sdf, scale);
        }
    }

    var buf = new ArrayBuffer(data.length);
    var uint8 = new Uint8Array(buf);
    sdf.buffer = buf;

    var shift = 191;
    var factor = 1 / sdf.valueScale * shift / sdf.edgeDist;
    for (var k = 0; k < data.length; k++) {
        var v = data[k] * factor + shift;
        uint8[k] = Math.min(255, Math.max(0, v));
    }

    return sdf;
}

function segmentSDF(start, end, next, sdf, scale) {
    var pad = Math.ceil(Math.SQRT2 * sdf.edgeDist);
    var data = sdf.data;
    var width = sdf.width;
    var height = sdf.height;

    var left = Math.ceil(sdf.glyph.xMin * scale) - sdf.padding;
    var bottom = Math.ceil(sdf.glyph.yMin * scale) - sdf.padding;

    var minX = Math.ceil(Math.min(start.x, end.x) * scale) - pad;
    var maxX = Math.ceil(Math.max(start.x, end.x) * scale) + pad;
    var minY = Math.ceil(Math.min(start.y, end.y) * scale) - pad;
    var maxY = Math.ceil(Math.max(start.y, end.y) * scale) + pad;

    minX = Math.max(0 + left, minX);
    maxX = Math.min(width + left, maxX);
    minY = Math.max(0 + bottom, minY);
    maxY = Math.min(height + bottom, maxY);

    var distStartToEndSqr = distSqr(start, end);
    var distStartToEnd = Math.sqrt(distStartToEndSqr);


    var endX = end.x - start.x;
    var endY = end.y - start.y;

    var factor = sdf.valueScale * scale;

    // When the point is closest to the end of the segment it isnt
    // clear whether to count it as inside or outside distance.
    // This switches depending on the distance the line turns next.
    var angle = Math.atan2(next.y - end.y, next.x - end.x) - Math.atan2(endY, endX);
    // clamp angle to -PI..PI
    angle = (angle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    var capFlip = angle > 0 ? 1 : -1;

    for (var x = minX; x < maxX; x++) {
        for (var y = minY; y < maxY; y++) {
            var index = (x - left) + width * (height - y + bottom);

            var scaledX = x / scale - start.x;
            var scaledY = y / scale - start.y;

            var t = (scaledX * endX + scaledY * endY);


            var dist;

            if (t < 0) {
                // closes point is the beginning of the segment 
                //dist = s * Math.sqrt(scaledX * scaledX + scaledY * scaledY);
                //dist = 127;

            } else if (t > distStartToEndSqr) {
                // closes point is the end of the segment
                var dx = endX - scaledX;
                var dy = endY - scaledY;
                dist = capFlip * Math.sqrt(dx * dx + dy * dy);

            } else {
                // closest point is in the middle of the segment
                var cross = endY * scaledX - endX * scaledY;
                dist = cross / distStartToEnd;
            }

            dist *= factor;

            if (Math.abs(dist) < Math.abs(data[index])) {
                data[index] = dist;
            }
        }
    }
}

function distSqr(a, b) {
    var dx = a.x - b.x,
        dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function interpBezier(a, p, b, t) {
    var apx = p.x - a.x;
    var apy = p.y - a.y;
    var pbx = b.x - p.x;
    var pby = b.y - p.y;

    var cx = a.x + t * apx;
    var cy = a.y + t * apy;
    var ex = p.x + t * pbx;
    var ey = p.y + t * pby;

    return {
        x: cx + t * (ex - cx),
        y: cy + t * (ey - cy),
        onCurve: true
    };
}

function expand(contour) {

    var expanded = [];
    // expand implicit on-curve points
    // http://stackoverflow.com/questions/20733790/
    var len = contour.length;
    for (var k = 0; k < len; k++) {
        var a = contour[k];
        var b = contour[(k + 1) % len];
        expanded.push(a);
        if (!a.onCurve && !b.onCurve) {
            expanded.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true });
        }

    }

    contour = expanded;

    // beziers to straight lines
    expanded = [];
    len = contour.length;
    for (var j = 0; j < len; j++) {
        var p = contour[j];
        if (p.onCurve) {
            expanded.push(p);
        } else {
            var e = contour[j - 1];
            var d = contour[(j + 1) % len];
            //expanded.push(interpBezier(e, p, d, 0.25));
            expanded.push(interpBezier(e, p, d, 0.5));
            //expanded.push(interpBezier(e, p, d, 0.75));
        }
    }
    return expanded;
}
