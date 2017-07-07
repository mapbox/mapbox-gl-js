'use strict';

/*
const Evented = require('../util/evented');
const util = require('../util/util');
const loadTileJSON = require('./load_tilejson');
const normalizeURL = require('../util/mapbox').normalizeTileURL;
const TileBounds = require('./tile_bounds');*/
const normalizeURL = require('../util/mapbox').normalizeTileURL;
const VectorTileSource = require('./vector_tile_source');

class VectorTileOfflineSource extends VectorTileSource {

    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);

        this.type = 'vectoroffline';
        //this.db = options.db;

        if(window.sqlitePlugin){

            //TODO control que tiles arriba amb el path correctament
            this.db = window.sqlitePlugin.openDatabase({
                        name: options.tiles[0], //"/storage/emulated/0/.mbtiles",
                        location: 2,
                        createFromLocation: 2,
                        androidDatabaseImplementation: 2
                    },function(){

                    },function(){
                        throw new Error('vector tile Offline sources not opened');
                    });

        }else{
            throw new Error('vector tile Offline sources need cordova-sqlite-ext extended -----> https://github.com/jessisena/cordova-sqlite-ext');
        }
    }


    readTile(z, x, y, db) {

        return new Promise(function(resolve, reject){

            const query = 'SELECT tile_data as myTile FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?';
            const params = [z, x, y];

            db.executeSql(query, params, 
            function (res) {
                if(res.rows.length > 0) {
                    //console.debug("MBTiles BLOB SELECTED OK" );
                    resolve(res.rows.item(0).myTile);                  
                }else{
                    resolve(undefined);
                }

            },function(error){
                //console.debug("MBTiles BLOB SELECTED KO" );
                reject(error);
            }
        );

        });

    }

    loadTile(tile, callback) {


        const overscaling = tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1;        
        const coordY = Math.pow(2, tile.coord.z) -1 - tile.coord.y;

        const params = {
            //url: normalizeURL(tile.coord.url(this.tiles, this.maxzoom, this.scheme), this.url),
            blob: undefined,
            uid: tile.uid,
            coord: tile.coord,
            zoom: tile.coord.z,
            tileSize: this.tileSize * overscaling,
            type: this.type,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle,
            pitch: this.map.transform.pitch,
            //Calen?
            cameraToCenterDistance: this.map.transform.cameraToCenterDistance,
            cameraToTileDistance: this.map.transform.cameraToTileDistance(tile),
            showCollisionBoxes: this.map.showCollisionBoxes
        };


        function readTileSuccess(blob){

            params.blob = blob;

            if (!tile.workerID || tile.state === 'expired') {
                tile.workerID = this.dispatcher.send('loadTile', params, done.bind(this));
            } else if (tile.state === 'loading') {
                // schedule tile reloading after it has been loaded
                tile.reloadCallback = callback;
            } else {
                this.dispatcher.send('reloadTile', params, done.bind(this), tile.workerID);
            }

            function done(err, data) {
                if (tile.aborted)
                    return;

                if (err) {
                    return callback(err);
                }

                if (this.map._refreshExpiredTiles) tile.setExpiryData(data);
                tile.loadVectorData(data, this.map.painter);

                if (tile.redoWhenDone) {
                    tile.redoWhenDone = false;
                    tile.redoPlacement(this);
                }

                callback(null);

                if (tile.reloadCallback) {
                    this.loadTile(tile, tile.reloadCallback);
                    tile.reloadCallback = null;
                }
            }

        }

        function readTileError(err){
            return callback(err);
        }

        this.readTile(tile.coord.z, tile.coord.x, coordY, this.db).then(
            readTileSuccess.bind(this), readTileError.bind(this)
        );
    
        
    }

}

module.exports = VectorTileOfflineSource;
