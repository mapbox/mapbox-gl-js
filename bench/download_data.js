'use strict';

// We download bench data within node to avoid external dependicies like `curl` or `wget`.

var fs = require('fs');
var http = require('http');

var filePath = './bench/data/naturalearth-land.json';

fs.access(filePath, fs.F_OK, function(err) {
    if (!err) return; // the file exists

    console.log('downloading benchmark data');
    var file = fs.createWriteStream(filePath);
    http.get('http://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson', function(response) {
        response.pipe(file);
        response.on('end', function() {
            console.log('done downloading benchmark data');
        });
    });
});
