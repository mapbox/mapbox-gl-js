var mapnik = require('mapnik');
var fs = require('fs');
var queue = require('d3-queue').queue;

function upgrade(z, x, y, path, callback) {
    console.log('Updating ', path);
    var buffer = fs.readFileSync(path);
    var vt = new mapnik.VectorTile(z, x, y);
    vt.addData(buffer, {upgrade: true, validate: true}, function(err) {
        if (err) throw err;
        fs.writeFileSync(path, vt.getDataSync());
        callback();
  });
}

function createExtent1024(callback) {
    console.log('Creating extent1024');
    var buffer = fs.readFileSync('14-8802-5374.mvt');
    var vt = new mapnik.VectorTile(14, 8802, 5374, { tileSize: 1024 });
    vt.addData(buffer, {validate: true}, function(err) {
        if (err) throw err;
        fs.writeFileSync('extent1024-14-8802-5374.mvt', vt.getDataSync());
        callback();
    });
}

var q = queue(1);

q.defer(upgrade, 0, 0, 0, '0-0-0.mvt');
q.defer(upgrade, 14, 8802, 5374, '14-8802-5374.mvt');
q.defer(upgrade, 14, 8802, 5375, '14-8802-5375.mvt');
q.defer(upgrade, 14, 8803, 5374, '14-8803-5374.mvt');
q.defer(upgrade, 14, 8803, 5375, '14-8803-5375.mvt');
q.defer(upgrade, 2, 1, 1, '2-1-1.mvt');
q.defer(upgrade, 2, 1, 2, '2-1-2.mvt');
q.defer(upgrade, 2, 2, 1, '2-2-1.mvt');
q.defer(upgrade, 2, 2, 2, '2-2-2.mvt');
q.defer(upgrade, 7, 37, 48, 'counties-7-37-48.mvt');
q.defer(createExtent1024);

q.await(function (err) {
    if (err) throw err;
    console.log('Done.');
});
