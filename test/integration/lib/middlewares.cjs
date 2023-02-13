/* eslint-disable import/no-commonjs */
const fs = require('fs');
const path = require('path');
const serveStatic = require('serve-static');

const defaultOptions = {
    index: false,
    fallthrough: false,
};

const ciOptions = {
    ...defaultOptions,
    // Explicitly indicate that revalidation is not required because the content never changes.
    maxAge: '1h',
    immutable: true,
    // Last-Modified is a weak caching header, as the browser applies a heuristic to determine
    // whether to fetch the item from the cache or not., and heuristics vary between browsers.
    etag: false,
    lastModified: false,
};

function injectMiddlewares(app, config = {ci: false}) {
    const options = config.ci ? ciOptions : defaultOptions;

    app.use('/mvt-fixtures', serveStatic(path.dirname(require.resolve('@mapbox/mvt-fixtures')), options));
    app.use('/mapbox-gl-styles', serveStatic(path.dirname(require.resolve('mapbox-gl-styles')), options));

    ['render-tests', 'image', 'geojson', 'video', 'tiles', 'glyphs', 'tilesets', 'sprites', 'data', 'models'].forEach(dir => {
        app.use(`/${dir}`, serveStatic(path.join(__dirname, '..', dir), options));
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
}

module.exports = {injectMiddlewares};
