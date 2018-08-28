/* eslint-disable import/unambiguous, import/no-commonjs */

const mapnik = require('mapnik');
const fs = require('fs');
const queue = require('d3-queue').queue;

function upgrade(z, x, y, path, callback) {
    console.log('Updating ', path);
    const buffer = fs.readFileSync(path);
    const vt = new mapnik.VectorTile(z, x, y);
    vt.addData(buffer, {upgrade: true, validate: true}, (err) => {
        if (err) throw err;
        fs.writeFileSync(path, vt.getDataSync());
        callback();
    });
}

function createExtent1024(callback) {
    console.log('Creating extent1024');
    const buffer = fs.readFileSync('14-8802-5374.mvt');
    const vt = new mapnik.VectorTile(14, 8802, 5374, { tileSize: 1024 });
    vt.addData(buffer, {validate: true}, (err) => {
        if (err) throw err;
        fs.writeFileSync('extent1024-14-8802-5374.mvt', vt.getDataSync());
        callback();
    });
}

const q = queue(1);

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

q.await((err) => {
    if (err) throw err;
    console.log('Done.');
});
