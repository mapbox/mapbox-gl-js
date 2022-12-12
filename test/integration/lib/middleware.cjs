/* eslint-disable import/no-commonjs */
const fs = require('fs');
const path = require('path');
const st = require('st');

const middleware = (app) => {
    app.use((req, res, next) => {
        console.log('Request URL:', req.originalUrl);
        next();
    });

    app.use('/mvt-fixtures', st({
        path: path.dirname(require.resolve('@mapbox/mvt-fixtures'))
    }));

    app.use('/mapbox-gl-styles', st({
        path: path.dirname(require.resolve('mapbox-gl-styles'))
    }));

    ['image', 'geojson', 'video', 'tiles', 'glyphs', 'tilesets', 'sprites', 'data'].forEach(p => {
        app.use(`/${p}`, st({path: path.join(__dirname, '..', p)}));
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
