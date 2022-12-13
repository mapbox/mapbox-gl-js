/* eslint-disable import/no-commonjs */
const fs = require('fs');
const path = require('path');
const serveStatic = require('serve-static');

const middleware = (app) => {
    app.use('/mvt-fixtures', serveStatic(path.dirname(require.resolve('@mapbox/mvt-fixtures'))));
    app.use('/mapbox-gl-styles', serveStatic(path.dirname(require.resolve('mapbox-gl-styles'))));

    ['image', 'geojson', 'video', 'tiles', 'glyphs', 'tilesets', 'sprites', 'data'].forEach(p => {
        app.use(`/${p}`, serveStatic(path.join(__dirname, '..', p)));
    });

    app.post('/write-file', (req, res) => {
        let body = '';
        req.on('data', (data) => {
            body += data;
        });

        return req.on('end', () => {
            const {filePath, data} = JSON.parse(body);

            let encoding;
            if (filePath.split('.')[1] !== 'json') {
                encoding = 'base64';
            }

            fs.writeFile(path.join(process.cwd(), filePath), data, encoding, () => {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('ok');
            });
        });
    });
};

module.exports = middleware;
