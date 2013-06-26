var express = require('express');
var request = require('request');
var fs = require('fs');

var app = express();

var maxAge = 86400;

app.get('/tiles2/:z/:x/:y.vector.pbf', function(req, res) {
    var filename = './tiles/' + req.params.z + '-' + req.params.x + '-' + req.params.y + '.vector.pbf';
    fs.readFile(filename, function(err, data) {
        if (err) {
            var url = "http://d1s11ojcu7opje.cloudfront.net/dev/764e0b8d/" +
                (+req.params.x % 16).toString(16) + (+req.params.y % 16).toString(16) +
                "/" + req.params.z + "/" + req.params.x + "/" + req.params.y + ".vector.pbf";
            request({
                url: url,
                encoding: null
            }, function(err, response, body) {
                if (err) {
                    console.warn(err.stack);
                    res.end();
                } else if (response.statusCode != 200) {
                    console.warn(response.statusCode, url);
                    res.end();
                } else {

                    fs.writeFileSync(filename, body);
                    res.header('Content-Encoding', 'deflate');
                    res.header('Content-Type', 'application/x-vectortile');
                    res.header('Cache-Control', 'max-age=' + maxAge);
                    // setTimeout(function() {
                        res.end(body);
                    // }, 500);
                }
            });
        } else {
            res.header('Content-Encoding', 'deflate');
            res.header('Content-Type', 'application/x-vectortile');
            res.header('Cache-Control', 'max-age=' + maxAge);
            // setTimeout(function() {
                res.end(data);
            // }, 500);
        }
    });
});

app.use(express.static(__dirname));

app.listen(8000);
