'use strict';

var util = require('mapbox-gl/js/util/util');
var ajax = require('mapbox-gl/js/util/ajax');
var browser = require('mapbox-gl/js/util/browser');
var TileCoord = require('mapbox-gl/js/source/tile_coord');
var TilePyramid = require('./esri-tile-pyramid');
var normalizeURL = require('mapbox-gl/js/util/mapbox').normalizeSourceURL;

exports._loadTileJSON = function(options) {
  var indexLoaded = function (err, index) {
    //util.extend(this._pyramid, util.pick(index, 'index'));

    this._pyramid = new TilePyramid({
      index: index.index,
      tileSize: this.tileSize,
      cacheSize: 20,
      minzoom: this.minzoom,
      maxzoom: this.maxzoom,
      reparseOverscaled: this.reparseOverscaled,
      load: this._loadTile.bind(this),
      abort: this._abortTile.bind(this),
      unload: this._unloadTile.bind(this),
      add: this._addTile.bind(this),
      remove: this._removeTile.bind(this)
    });

    this.fire('load');
  };

  var loaded = function (err, tileJSON) {
    if (err) {
      this.fire('error', {error: err});
      return;
    }

    util.extend(this, util.pick(tileJSON,
      'tiles', 'minzoom', 'maxzoom', 'attribution'));

    if (tileJSON.index){
      //console.log("Getting index from: ", tileJSON.index);
      ajax.getJSON(normalizeURL(tileJSON.index), indexLoaded.bind(this));
    }
    else{
      this._pyramid = new TilePyramid({
        tileSize: this.tileSize,
        cacheSize: 20,
        minzoom: this.minzoom,
        maxzoom: this.maxzoom,
        reparseOverscaled: this.reparseOverscaled,
        load: this._loadTile.bind(this),
        abort: this._abortTile.bind(this),
        unload: this._unloadTile.bind(this),
        add: this._addTile.bind(this),
        remove: this._removeTile.bind(this)
      });

      this.fire('load');
    }
  }.bind(this);

  if (options.url) {
    ajax.getJSON(normalizeURL(options.url), loaded);
  }
  else {
    browser.frame(loaded.bind(this, null, options));
  }
};

exports._renderTiles = function(layers, painter) {
  if (!this._pyramid)
    return;

  var ids = this._pyramid.renderedIDs();
  for (var i = 0; i < ids.length; i++) {
    var pos = TileCoord.fromID(ids[i]),
      tile = this._pyramid.getTile(ids[i]),
      z = pos.z,
      x = pos.x,
      y = pos.y,
      w = pos.w;

    // if z > maxzoom then the tile is actually a overscaled maxzoom tile,
    // so calculate the matrix the maxzoom tile would use.
    z = Math.min(z, this.maxzoom);

    x += w * (1 << z);
    tile.calculateMatrices(z, x, y, painter.transform, painter);

    painter.drawTile(tile, layers);
  }
};

exports._vectorFeaturesAt = function(point, params, callback) {
  if (!this._pyramid)
    return callback(null, []);

  var result = this._pyramid.tileAt(point);
  if (!result)
    return callback(null, []);

  this.dispatcher.send('query features', {
    uid: result.tile.uid,
    x: result.x,
    y: result.y,
    scale: result.scale,
    source: this.id,
    params: params
  }, callback, result.tile.workerID);
};

exports.create = function(source) {
  // This is not at file scope in order to avoid a circular require.
  var sources = {
    vector: require('mapbox-gl/js/source/vector_tile_source'),
    indexedVector: require('mapbox-gl/js/source/vector_tile_source'),
    raster: require('mapbox-gl/js/source/raster_tile_source')
  };

  for (var type in sources) {
    if (source instanceof sources[type]) {
      return source;
    }
  }

  return new sources[source.type](source);
};
