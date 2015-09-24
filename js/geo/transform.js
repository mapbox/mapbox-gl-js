'use strict';

var LngLat = require('./lng_lat'),
    Point = require('point-geometry'),
    Coordinate = require('./coordinate'),
    wrap = require('../util/util').wrap,
    interp = require('../util/interpolate'),
    vec4 = require('gl-matrix').vec4,
    mat4 = require('gl-matrix').mat4;

module.exports = Transform;

/*
 * A single transform, generally used for a single tile to be
 * scaled, rotated, and zoomed.
 *
 * @param {number} minZoom
 * @param {number} maxZoom
 * @private
 */
function Transform(minZoom, maxZoom) {
    this.tileSize = 512; // constant

    this._minZoom = minZoom || 0;
    this._maxZoom = maxZoom || 22;

    this.latRange = [-85.05113, 85.05113];

    this.width = 0;
    this.height = 0;
    this.zoom = 0;
    this.center = new LngLat(0, 0);
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

    get center() { return this._center; },
    set center(center) {
        this._center = center;
        this._constrain();
    },

    zoomScale: function(zoom) { return Math.pow(2, zoom); },
    scaleZoom: function(scale) { return Math.log(scale) / Math.LN2; },

    project: function(lnglat, worldSize) {
        return new Point(
            this.lngX(lnglat.lng, worldSize),
            this.latY(lnglat.lat, worldSize));
    },

    unproject: function(point, worldSize) {
        return new LngLat(
            this.xLng(point.x, worldSize),
            this.yLat(point.y, worldSize));
    },

    get x() { return this.lngX(this.center.lng); },
    get y() { return this.latY(this.center.lat); },

    get point() { return new Point(this.x, this.y); },

    /**
     * latitude to absolute x coord
     * @param {number} lon
     * @param {number} [worldSize=this.worldSize]
     * @returns {number} pixel coordinate
     * @private
     */
    lngX: function(lng, worldSize) {
        return (180 + lng) * (worldSize || this.worldSize) / 360;
    },
    /**
     * latitude to absolute y coord
     * @param {number} lat
     * @param {number} [worldSize=this.worldSize]
     * @returns {number} pixel coordinate
     * @private
     */
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
    },

    setLocationAtPoint: function(lnglat, point) {
        var c = this.locationCoordinate(lnglat);
        var coordAtPoint = this.pointCoordinate(point);
        var coordCenter = this.pointCoordinate(this.centerPoint);

        var translate = coordAtPoint._sub(c);
        this.center = this.coordinateLocation(coordCenter._sub(translate));
    },

    setZoomAround: function(zoom, center) {
        var p;
        if (center) p = this.locationPoint(center);
        this.zoom = zoom;
        if (center) this.setLocationAtPoint(center, p);
    },

    setBearingAround: function(bearing, center) {
        var p;
        if (center) p = this.locationPoint(center);
        this.bearing = bearing;
        if (center) this.setLocationAtPoint(center, p);
    },

    /**
     * Given a location, return the screen point that corresponds to it
     * @param {LngLat} lnglat location
     * @returns {Point} screen point
     * @private
     */
    locationPoint: function(lnglat) {
        return this.coordinatePoint(this.locationCoordinate(lnglat));
    },

    /**
     * Given a point on screen, return its lnglat
     * @param {Point} p screen point
     * @returns {LngLat} lnglat location
     * @private
     */
    pointLocation: function(p) {
        return this.coordinateLocation(this.pointCoordinate(p));
    },

    /**
     * Given a geographical lnglat, return an unrounded
     * coordinate that represents it at this transform's zoom level and
     * worldsize.
     * @param {LngLat} lnglat
     * @returns {Coordinate}
     * @private
     */
    locationCoordinate: function(lnglat) {
        var k = this.zoomScale(this.tileZoom) / this.worldSize,
            ll = LngLat.convert(lnglat);

        return new Coordinate(
            this.lngX(ll.lng) * k,
            this.latY(ll.lat) * k,
            this.tileZoom);
    },

    /**
     * Given a Coordinate, return its geographical position.
     * @param {Coordinate} coord
     * @returns {LngLat} lnglat
     * @private
     */
    coordinateLocation: function(coord) {
        var worldSize = this.zoomScale(coord.zoom);
        return new LngLat(
            this.xLng(coord.column, worldSize),
            this.yLat(coord.row, worldSize));
    },

    pointCoordinate: function(p, targetZ) {

        if (targetZ === undefined) targetZ = 0;

        var matrix = this.coordinatePointMatrix(this.tileZoom);
        var inverted = mat4.invert(new Float64Array(16), matrix);

        if (!inverted) throw new Error("failed to invert matrix");

        // since we don't know the correct projected z value for the point,
        // unproject two points to get a line and then find the point on that
        // line with z=0

        var coord0 = vec4.transformMat4([], [p.x, p.y, 0, 1], inverted);
        var coord1 = vec4.transformMat4([], [p.x, p.y, 1, 1], inverted);

        var w0 = coord0[3];
        var w1 = coord1[3];
        var x0 = coord0[0] / w0;
        var x1 = coord1[0] / w1;
        var y0 = coord0[1] / w0;
        var y1 = coord1[1] / w1;
        var z0 = coord0[2] / w0;
        var z1 = coord1[2] / w1;


        var t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);

        return new Coordinate(
            interp(x0, x1, t),
            interp(y0, y1, t),
            this.tileZoom);
    },

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param {Coordinate} coord
     * @returns {Point} screen point
     * @private
     */
    coordinatePoint: function(coord) {
        var matrix = this.coordinatePointMatrix(coord.zoom);
        var p = vec4.transformMat4([], [coord.column, coord.row, 0, 1], matrix);
        return new Point(p[0] / p[3], p[1] / p[3]);
    },

    coordinatePointMatrix: function(z) {
        var proj = this.getProjMatrix();
        var scale = this.worldSize / this.zoomScale(z);
        mat4.scale(proj, proj, [scale, scale, 1]);
        mat4.multiply(proj, this.getPixelMatrix(), proj);
        return proj;
    },

    /**
     * converts gl coordinates -1..1 to pixels 0..width
     * @returns {Object} matrix
     * @private
     */
    getPixelMatrix: function() {
        var m = mat4.create();
        mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        return m;
    },

    _constrain: function() {
        if (!this.center || !this.width || !this.height || this._constraining) return;

        this._constraining = true;

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
            this._constraining = false;
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

        this._constraining = false;
    },

    getProjMatrix: function() {
        var m = new Float64Array(16);

        // Find the distance from the center point to the center top in altitude units using law of sines.
        var halfFov = Math.atan(0.5 / this.altitude);
        var topHalfSurfaceDistance = Math.sin(halfFov) * this.altitude / Math.sin(Math.PI / 2 - this._pitch - halfFov);
        // Calculate z value of the farthest fragment that should be rendered.
        var farZ = Math.cos(Math.PI / 2 - this._pitch) * topHalfSurfaceDistance + this.altitude;

        mat4.perspective(m, 2 * Math.atan((this.height / 2) / this.altitude), this.width / this.height, 0.1, farZ);

        mat4.translate(m, m, [0, 0, -this.altitude]);

        // After the rotateX, z values are in pixel units. Convert them to
        // altitude unites. 1 altitude unit = the screen height.
        mat4.scale(m, m, [1, -1, 1 / this.height]);

        mat4.rotateX(m, m, this._pitch);
        mat4.rotateZ(m, m, this.angle);
        mat4.translate(m, m, [-this.x, -this.y, 0]);
        return m;
    }
};
