/* eslint-disable import-x/no-commonjs */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mapnik = require('mapnik');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

function upgrade(z, x, y, path) {
    console.log('Updating ', path);
    const buffer = fs.readFileSync(path);
    const vt = new mapnik.VectorTile(z, x, y);
    return new Promise((resolve, reject) => {
        vt.addData(buffer, {upgrade: true, validate: true}, (err) => {
            if (err) return reject(err);
            fs.writeFileSync(path, vt.getDataSync());
            resolve();
        });
    });
}

function createExtent1024() {
    console.log('Creating extent1024');
    const buffer = fs.readFileSync('14-8802-5374.mvt');
    const vt = new mapnik.VectorTile(14, 8802, 5374, {tileSize: 1024});
    return new Promise((resolve, reject) => {
        vt.addData(buffer, {validate: true}, (err) => {
            if (err) return reject(err);
            fs.writeFileSync('extent1024-14-8802-5374.mvt', vt.getDataSync());
            resolve();
        });
    });
}

(async () => {
    await upgrade(0, 0, 0, '0-0-0.mvt');
    await upgrade(14, 8802, 5374, '14-8802-5374.mvt');
    await upgrade(14, 8802, 5375, '14-8802-5375.mvt');
    await upgrade(14, 8803, 5374, '14-8803-5374.mvt');
    await upgrade(14, 8803, 5375, '14-8803-5375.mvt');
    await upgrade(2, 1, 1, '2-1-1.mvt');
    await upgrade(2, 1, 2, '2-1-2.mvt');
    await upgrade(2, 2, 1, '2-2-1.mvt');
    await upgrade(2, 2, 2, '2-2-2.mvt');
    await upgrade(7, 37, 48, 'counties-7-37-48.mvt');
    await createExtent1024();
    console.log('Done.');
})();
