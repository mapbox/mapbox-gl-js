var request = require('request');
var zlib = require('zlib');
var vt = require('vector-tile');
var Protobuf = require('pbf');

request({url: 'https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/3/2/4.vector.pbf?access_token=pk.eyJ1IjoiamZpcmUiLCJhIjoiVkRqZHhXTSJ9.k3r6TYm9oetgLQX0A_nQbQ', encoding: null}, function(error, response, body) {
    zlib.gunzip(body, function(err, data) {
        var tile = new vt.VectorTile(new Protobuf(data));
        var layer = tile.layers["state_label"];

        var collection = {type: "FeatureCollection", features: []};

        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i).toGeoJSON(2, 4, 3);
            feature.coordinates = layer.feature(i).loadGeometry();
            collection.features.push(feature);
        }

        console.log(JSON.stringify(collection, null, 2));
    });
});
