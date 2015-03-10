'use strict';

var LatLng = require('./lat_lng'),
    Point = require('point-geometry'),
    wrap = require('../util/util').wrap,
    mat4 = require('gl-matrix').mat4;

module.exports = Transform;

// A single transform, generally used for a single tile to be scaled, rotated, and zoomed.

function Transform(minZoom, maxZoom) {
    this.tileSize = 512; // constant

    this._minZoom = minZoom || 0;
    this._maxZoom = maxZoom || 22;

    this.latRange = [-85.05113, 85.05113];

    this.width = 0;
    this.height = 0;
    this.zoom = 0;
    this.center = new LatLng(0, 0);
    this.angle = 0;
    this._altitude = 1.5;
    this._pitch = 0;
}

Transform.prototype = {
    get minZoom() { return this._minZoom; },
    set minZoom(zoom) {
        this._minZoom = zoom;
        this.zoom = Math.max(this.zoom, zoom);
    },

    get maxZoom() { return this._maxZoom; },
    set maxZoom(zoom) {
        this._maxZoom = zoom;
        this.zoom = Math.min(this.zoom, zoom);
    },

    get worldSize() {
        return this.tileSize * this.scale;
    },

    get centerPoint() {
        return this.size._div(2);
    },

    get size() {
        return new Point(this.width, this.height);
    },

    get bearing() {
        return -this.angle / Math.PI * 180;
    },
    set bearing(bearing) {
        this.angle = -wrap(bearing, -180, 180) * Math.PI / 180;
    },

    get pitch() {
        return this._pitch / Math.PI * 180;
    },
    set pitch(pitch) {
        this._pitch = Math.min(60, pitch) / 180 * Math.PI;
    },

    get altitude() {
        return this._altitude;
    },
    set altitude(altitude) {
        this._altitude = Math.max(0.75, altitude);
    },

    get zoom() { return this._zoom; },
    set zoom(zoom) {
        zoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
        this._zoom = zoom;
        this.scale = this.zoomScale(zoom);
        this.tileZoom = Math.floor(zoom);
        this.zoomFraction = zoom - this.tileZoom;
        this._constrain();
    },

    zoomScale: function(zoom) { return Math.pow(2, zoom); },
    scaleZoom: function(scale) { return Math.log(scale) / Math.LN2; },

    project: function(latlng, worldSize) {
        return new Point(
            this.lngX(latlng.lng, worldSize),
            this.latY(latlng.lat, worldSize));
    },

    unproject: function(point, worldSize) {
        return new LatLng(
            this.yLat(point.y, worldSize),
            this.xLng(point.x, worldSize));
    },

    get x() { return this.lngX(this.center.lng); },
    get y() { return this.latY(this.center.lat); },

    get point() { return new Point(this.x, this.y); },

    // lat/lon <-> absolute pixel coords convertion
    lngX: function(lon, worldSize) {
        return (180 + lon) * (worldSize || this.worldSize) / 360;
    },
    // latitude to absolute y coord
    latY: function(lat, worldSize) {
        var y = 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        return (180 - y) * (worldSize || this.worldSize) / 360;
    },

    xLng: function(x, worldSize) {
        return x * 360 / (worldSize || this.worldSize) - 180;
    },
    yLat: function(y, worldSize) {
        var y2 = 180 - y * 360 / (worldSize || this.worldSize);
        return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
    },

    panBy: function(offset) {
        var point = this.centerPoint._add(offset);
        this.center = this.pointLocation(point);
        this._constrain();
    },

    setZoomAround: function(zoom, center) {
        var p = this.locationPoint(center),
            p1 = this.size._sub(p),
            latlng = this.pointLocation(p1);
        this.zoom = zoom;
        this.panBy(p1.sub(this.locationPoint(latlng)));
    },

    setBearingAround: function(bearing, center) {
        var offset = this.locationPoint(center).sub(this.centerPoint);
        this.panBy(offset);
        this.bearing = bearing;
        this.panBy(offset.mult(-1));
    },

    locationPoint: function(latlng) {
        var p = this.project(latlng);
        return this.centerPoint._sub(this.point._sub(p)._rotate(this.angle));
    },

    pointLocation: function(p) {
        var p2 = this.centerPoint._sub(p)._rotate(-this.angle);
        return this.unproject(this.point.sub(p2));
    },

    locationCoordinate: function(latlng) {
        var k = this.zoomScale(this.tileZoom) / this.worldSize;
        return {
            column: this.lngX(latlng.lng) * k,
            row: this.latY(latlng.lat) * k,
            zoom: this.tileZoom
        };
    },

    pointCoordinate: function(_, p) {
        var m = this.coordinatePointMatrix(this.tileZoom);


        // We know:
        // the matrix, unprojected z, y (0, 1), and projected x, y (point)
        // We don't know:
        // the unprojected x, y (which we want), and the projected z, y
        //
        // Solve 3 equations with three unknowns
        //
        // We could invert the matrix and use that to unproject, but then we
        // need to know the projected z value. We only know x, y.

        // Terrible temporary hack to avoid division by 0
        if (p.x === 0) p.x = 1;
        if (p.y === 0) p.y = 1;

        var f1 = m[0] / m[1];
        var g1 = p.x - f1 * p.y;
        // 0 = a1 * x + b1 * y + c1
        var a1 = m[3];
        var b1 = m[7] - (m[4] - f1 * m[5]) / g1;
        var c1 = m[15] - (m[12] - f1 * m[13]) / g1;

        if (m[1] === 0) {
            a1 = m[3];
            b1 = m[7] - m[5] / p.y;
            c1 = m[15] - m[13] / p.y;
        }

        var f2 = m[4] / m[5];
        var g2 = p.x - f2 * p.y;
        // 0 = a2 * x + b2 * y + c2
        var a2 = m[3] - (m[0] - f2 * m[1]) / g2;
        var b2 = m[7];
        var c2 = m[15] - (m[12] - f2 * m[13]) / g2;

        if (m[5] === 0) {
            a2 = m[3] - m[1] / p.y;
            b2 = m[7];
            c2 = m[15] - m[13] / p.y;
        }

        var f3 = a1 / a2;
        var b3 = b1 - f3 * b2;
        var c3 = c1 - f3 * c2;
        var y = -c3 / b3;

        var x = a1 !== 0 ?
            -(b1 * y + c1) / a1 :
            -(b2 * y + c2) / a2;

        return {
            column: x,
            row: y,
            zoom: this.tileZoom
        };
    },

    coordinatePointMatrix: function(z) {
        var proj = this.getProjMatrix();
        var tileScale = Math.pow(2, z); // number of tiles along an edge at that z level
        var scale = this.worldSize / tileScale;
        mat4.scale(proj, proj, [scale, scale, 1]);
        mat4.multiply(proj, this.getPixelMatrix(), proj);
        return proj;
    },

    // converts pixel points to gl coords
    getPixelMatrix: function() {
        // gl coords to screen coords
        var m = mat4.create();
        mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        return m;
    },

    _constrain: function() {
        if (!this.center) return;

        var minY, maxY, minX, maxX, sy, sx, x2, y2,
            size = this.size;

        if (this.latRange) {
            minY = this.latY(this.latRange[1]);
            maxY = this.latY(this.latRange[0]);
            sy = maxY - minY < size.y ? size.y / (maxY - minY) : 0;
        }

        if (this.lngRange) {
            minX = this.lngX(this.lngRange[0]);
            maxX = this.lngX(this.lngRange[1]);
            sx = maxX - minX < size.x ? size.x / (maxX - minX) : 0;
        }

        // how much the map should scale to fit the screen into given latitude/longitude ranges
        var s = Math.max(sx || 0, sy || 0);

        if (s) {
            this.center = this.unproject(new Point(
                sx ? (maxX + minX) / 2 : this.x,
                sy ? (maxY + minY) / 2 : this.y));
            this.zoom += this.scaleZoom(s);
            return;
        }

        if (this.latRange) {
            var y = this.y,
                h2 = size.y / 2;

            if (y - h2 < minY) y2 = minY + h2;
            if (y + h2 > maxY) y2 = maxY - h2;
        }

        if (this.lngRange) {
            var x = this.x,
                w2 = size.x / 2;

            if (x - w2 < minX) x2 = minX + w2;
            if (x + w2 > maxX) x2 = maxX - w2;
        }

        // pan the map if the screen goes off the range
        if (x2 !== undefined || y2 !== undefined) {
            this.center = this.unproject(new Point(
                x2 !== undefined ? x2 : this.x,
                y2 !== undefined ? y2 : this.y));
        }
    },

    getProjMatrix: function() {
        var m = new Float64Array(16);
        mat4.perspective(m, 2 * Math.atan((this.height / 2) / this.altitude), this.width / this.height, 0, this.altitude + 1);

        // Subtracting by one z pixel here is weird. I'm not sure exactly what is going on,
        // but this fixes tiny rendering differences between top-down (pitch=0) images rendered
        // rendered with different altitude values. Without this, images with smaller altitude appear
        // a tiny bit more zoomed. The difference is almost imperceptible, but it affects rendering tests.
        var onePixelZ = 1 / this.height;

        mat4.translate(m, m, [0, 0, -this.altitude - onePixelZ]);

        // After the rotateX, z values are in pixel units. Convert them to
        // altitude unites. 1 altitude unit = the screen height.
        mat4.scale(m, m, [1, -1, 1 / this.height]);

        mat4.rotateX(m, m, this._pitch);
        mat4.rotateZ(m, m, this.angle);
        mat4.translate(m, m, [-this.x, -this.y, 0]);
        return m;
    }
};
