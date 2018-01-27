const GeoJSONSource = require('../src/source/geojson_source');
const webworkify = require('webworkify');
const tilebelt = require('@mapbox/tilebelt');

class LineStringSource extends GeoJSONSource {
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'linestring';
        const feature = this._data.features[0].geometry;

        this.workerOptions.maxzoom = this.maxzoom.toString();
        this.workerOptions.covers = {};

        for (let i = this.minzoom; i <= this.maxzoom; i++) {
            this.workerOptions.covers[i] = getTiles(feature, i);
        }
    }
}

LineStringSource.workerSourceURL = URL.createObjectURL(webworkify(require('./linestring_worker.js'), {bare: true}));

module.exports = LineStringSource;

// extracted from @mapbox/tile-cover and simplified; modified to return
// duplicates where a line crosses back into a previously visited tile
function getTiles(geom, zoom) {
    var coords = geom.coordinates,
        tiles = [];

    var prevX, prevY;

    for (var i = 0; i < coords.length - 1; i++) {
        var start = tilebelt.pointToTileFraction(coords[i][0], coords[i][1], zoom),
            stop = tilebelt.pointToTileFraction(coords[i + 1][0], coords[i + 1][1], zoom),
            x0 = start[0],
            y0 = start[1],
            x1 = stop[0],
            y1 = stop[1],
            dx = x1 - x0,
            dy = y1 - y0;

        if (dy === 0 && dx === 0) continue;

        var sx = dx > 0 ? 1 : -1,
            sy = dy > 0 ? 1 : -1,
            x = Math.floor(x0),
            y = Math.floor(y0),
            tMaxX = dx === 0 ? Infinity : Math.abs(((dx > 0 ? 1 : 0) + x - x0) / dx),
            tMaxY = dy === 0 ? Infinity : Math.abs(((dy > 0 ? 1 : 0) + y - y0) / dy),
            tdx = Math.abs(sx / dx),
            tdy = Math.abs(sy / dy);

        if (x !== prevX || y !== prevY) {
            tiles.push([x, y, zoom]);
            prevX = x;
            prevY = y;
        }

        while (tMaxX < 1 || tMaxY < 1) {
            if (tMaxX < tMaxY) {
                tMaxX += tdx;
                x += sx;
            } else {
                tMaxY += tdy;
                y += sy;
            }
            tiles.push([x, y, zoom]);
            prevX = x;
            prevY = y;
        }
    }

    let tileHash = {};
    for (let i = 0; i < tiles.length; i++) {
        const id = tiles[i].join('/');
        if (!tileHash[id]) tileHash[id] = [i];
        else tileHash[id].push(i);
    }

    return {
        order: tiles.map(t => t.join('/')),
        hash: tileHash
    };
}
