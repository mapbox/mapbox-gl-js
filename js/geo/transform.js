'use strict';

var LngLat = require('./lng_lat'),
    Point = require('point-geometry'),
    Coordinate = require('./coordinate'),
    wrap = require('../util/util').wrap,
    interp = require('../util/interpolate'),
    TileCoord = require('../source/tile_coord'),
    EXTENT = require('../data/bucket').EXTENT,
    glmatrix = require('gl-matrix');

var vec4 = glmatrix.vec4,
    mat4 = glmatrix.mat4,
    mat2 = glmatrix.mat2;

module.exports = Transform;

/**
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
    this._center = new LngLat(0, 0);
    this.zoom = 0;
    this.angle = 0;
    this._altitude = 1.5;
    this._pitch = 0;
    this._unmodified = true;
}

Transform.prototype = {
    get minZoom() { return this._minZoom; },
    set minZoom(zoom) {
        if (this._minZoom === zoom) return;
        this._minZoom = zoom;
        this.zoom = Math.max(this.zoom, zoom);
    },

    get maxZoom() { return this._maxZoom; },
    set maxZoom(zoom) {
        if (this._maxZoom === zoom) return;
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
        var b = -wrap(bearing, -180, 180) * Math.PI / 180;
        if (this.angle === b) return;
        this._unmodified = false;
        this.angle = b;
        this._calcMatrices();

        // 2x2 matrix for rotating points
        this.rotationMatrix = mat2.create();
        mat2.rotate(this.rotationMatrix, this.rotationMatrix, this.angle);
    },

    get pitch() {
        return this._pitch / Math.PI * 180;
    },
    set pitch(pitch) {
        var p = Math.min(60, pitch) / 180 * Math.PI;
        if (this._pitch === p) return;
        this._unmodified = false;
        this._pitch = p;
        this._calcMatrices();
    },

    get altitude() {
        return this._altitude;
    },
    set altitude(altitude) {
        var a = Math.max(0.75, altitude);
        if (this._altitude === a) return;
        this._unmodified = false;
        this._altitude = a;
        this._calcMatrices();
    },

    get zoom() { return this._zoom; },
    set zoom(zoom) {
        var z = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
        if (this._zoom === z) return;
        this._unmodified = false;
        this._zoom = z;
        this.scale = this.zoomScale(z);
        this.tileZoom = Math.floor(z);
        this.zoomFraction = z - this.tileZoom;
        this._calcMatrices();
        this._constrain();
    },

    get center() { return this._center; },
    set center(center) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;
        this._unmodified = false;
        this._center = center;
        this._calcMatrices();
        this._constrain();
    },

    /**
     * Return a zoom level that will cover all tiles the transform
     * @param {Object} options
     * @param {number} options.tileSize
     * @param {boolean} options.roundZoom
     * @returns {number} zoom level
     * @private
     */
    coveringZoomLevel: function(options) {
        return (options.roundZoom ? Math.round : Math.floor)(
            this.zoom + this.scaleZoom(this.tileSize / options.tileSize)
        );
    },

    /**
     * Return all coordinates that could cover this transform for a covering
     * zoom level.
     * @param {Object} options
     * @param {number} options.tileSize
     * @param {number} options.minzoom
     * @param {number} options.maxzoom
     * @param {boolean} options.roundZoom
     * @param {boolean} options.reparseOverscaled
     * @returns {Array<Tile>} tiles
     * @private
     */
    coveringTiles: function(options) {
        var z = this.coveringZoomLevel(options);
        var actualZ = z;

        if (z < options.minzoom) return [];
        if (z > options.maxzoom) z = options.maxzoom;

        var tr = this,
            tileCenter = tr.locationCoordinate(tr.center)._zoomTo(z),
            centerPoint = new Point(tileCenter.column - 0.5, tileCenter.row - 0.5);

        return TileCoord.cover(z, [
            tr.pointCoordinate(new Point(0, 0))._zoomTo(z),
            tr.pointCoordinate(new Point(tr.width, 0))._zoomTo(z),
            tr.pointCoordinate(new Point(tr.width, tr.height))._zoomTo(z),
            tr.pointCoordinate(new Point(0, tr.height))._zoomTo(z)
        ], options.reparseOverscaled ? actualZ : z).sort(function(a, b) {
            return centerPoint.dist(a) - centerPoint.dist(b);
        });
    },

    resize: function(width, height) {
        this.width = width;
        this.height = height;

        this.pixelsToGLUnits = [2 / width, -2 / height];
        this._calcMatrices();
        this._constrain();
    },

    get unmodified() { return this._unmodified; },

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
        this._unmodified = false;
        this.center = this.coordinateLocation(coordCenter._sub(translate));
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

    pointCoordinate: function(p) {

        var targetZ = 0;
        // since we don't know the correct projected z value for the point,
        // unproject two points to get a line and then find the point on that
        // line with z=0

        var coord0 = [p.x, p.y, 0, 1];
        var coord1 = [p.x, p.y, 1, 1];

        vec4.transformMat4(coord0, coord0, this.pixelMatrixInverse);
        vec4.transformMat4(coord1, coord1, this.pixelMatrixInverse);

        var w0 = coord0[3];
        var w1 = coord1[3];
        var x0 = coord0[0] / w0;
        var x1 = coord1[0] / w1;
        var y0 = coord0[1] / w0;
        var y1 = coord1[1] / w1;
        var z0 = coord0[2] / w0;
        var z1 = coord1[2] / w1;


        var t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);
        var scale = this.worldSize / this.zoomScale(this.tileZoom);

        return new Coordinate(
            interp(x0, x1, t) / scale,
            interp(y0, y1, t) / scale,
            this.tileZoom);
    },

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param {Coordinate} coord
     * @returns {Point} screen point
     * @private
     */
    coordinatePoint: function(coord) {
        var scale = this.worldSize / this.zoomScale(coord.zoom);
        var p = [coord.column * scale, coord.row * scale, 0, 1];
        vec4.transformMat4(p, p, this.pixelMatrix);
        return new Point(p[0] / p[3], p[1] / p[3]);
    },

    /**
     * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
     * @param {TileCoord|Coordinate} coord
     * @param {Number} maxZoom maximum source zoom to account for overscaling
     * @private
     */
    calculatePosMatrix: function(coord, maxZoom) {
        if (maxZoom === undefined) maxZoom = Infinity;
        if (coord instanceof TileCoord) coord = coord.toCoordinate(maxZoom);

        // Initialize model-view matrix that converts from the tile coordinates to screen coordinates.

        // if z > maxzoom then the tile is actually a overscaled maxzoom tile,
        // so calculate the matrix the maxzoom tile would use.
        var z = Math.min(coord.zoom, maxZoom);

        var scale = this.worldSize / Math.pow(2, z);
        var posMatrix = new Float64Array(16);

        mat4.identity(posMatrix);
        mat4.translate(posMatrix, posMatrix, [coord.column * scale, coord.row * scale, 0]);
        mat4.scale(posMatrix, posMatrix, [ scale / EXTENT, scale / EXTENT, 1 ]);
        mat4.multiply(posMatrix, this.projMatrix, posMatrix);

        return new Float32Array(posMatrix);
    },

    _constrain: function() {
        if (!this.center || !this.width || !this.height || this._constraining) return;

        this._constraining = true;

        var minY, maxY, minX, maxX, sy, sx, x2, y2,
            size = this.size,
            unmodified = this._unmodified;

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
            this._unmodified = unmodified;
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

        this._unmodified = unmodified;
        this._constraining = false;
    },

    _calcMatrices: function() {
        if (!this.height) return;

        // Find the distance from the center point to the center top in altitude units using law of sines.
        var halfFov = Math.atan(0.5 / this.altitude);
        var topHalfSurfaceDistance = Math.sin(halfFov) * this.altitude / Math.sin(Math.PI / 2 - this._pitch - halfFov);

        // Calculate z value of the farthest fragment that should be rendered.
        var farZ = Math.cos(Math.PI / 2 - this._pitch) * topHalfSurfaceDistance + this.altitude;

        // matrix for conversion from location to GL coordinates (-1 .. 1)
        var m = new Float64Array(16);
        mat4.perspective(m, 2 * Math.atan((this.height / 2) / this.altitude), this.width / this.height, 0.1, farZ);
        mat4.translate(m, m, [0, 0, -this.altitude]);

        // After the rotateX, z values are in pixel units. Convert them to
        // altitude units. 1 altitude unit = the screen height.
        mat4.scale(m, m, [1, -1, 1 / this.height]);

        mat4.rotateX(m, m, this._pitch);
        mat4.rotateZ(m, m, this.angle);
        mat4.translate(m, m, [-this.x, -this.y, 0]);

        this.projMatrix = m;

        // matrix for conversion from location to screen coordinates
        m = mat4.create();
        mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        this.pixelMatrix = mat4.multiply(new Float64Array(16), m, this.projMatrix);

        // inverse matrix for conversion from screen coordinaes to location
        m = mat4.invert(new Float64Array(16), this.pixelMatrix);
        if (!m) throw new Error("failed to invert matrix");
        this.pixelMatrixInverse = m;
    }
};
