
import fs from 'fs';
import path, {dirname} from 'path';
import serveStatic from 'serve-static';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';
import {localizeSourceURLs} from './localize-urls.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const defaultOptions = {
    index: false,
    fallthrough: false,
};

export const ciOptions = {
    ...defaultOptions,
    // Explicitly indicate that revalidation is not required because the content never changes.
    maxAge: '1h',
    immutable: true,
    // Last-Modified is a weak caching header, as the browser applies a heuristic to determine
    // whether to fetch the item from the cache or not., and heuristics vary between browsers.
    etag: false,
    lastModified: false,
};

export async function writeFile(req, res) {
    let body = '';
    req.on('data', (data) => {
        body += data;
    });

    return req.on('end', () => {
        const {filePath, data} = JSON.parse(body);

        /** @type {'base64'} */
        let encoding;
        if (filePath.split('.')[1] !== 'json') {
            encoding = 'base64';
        }

        fs.writeFile(path.join(process.cwd(), filePath), data, encoding, () => {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('ok');
        });
    });
}

export async function tilesets(req, res) {
    const baseDir = path.join(__dirname, '..', 'tilesets');
    const filePath = path.resolve(baseDir, `.${req.url}`);

    if (!filePath.startsWith(baseDir)) {
        res.writeHead(403, {'Content-Type': 'text/plain'});
        res.end('Forbidden');
        return;
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    const json = JSON.parse(fileContent);

    const port = req.socket.localPort;
    localizeSourceURLs(json, port);

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(json));
}

export const staticFolders = [
    'render-tests',
    'image',
    'geojson',
    'video',
    'tiles',
    'glyphs',
    'sprites',
    'data',
    'models'
];

export function injectMiddlewares(app, config = {ci: false}) {
    const options = config.ci ? ciOptions : defaultOptions;

    app.use('/mvt-fixtures', serveStatic(path.dirname(require.resolve('@mapbox/mvt-fixtures')), options));
    app.use('/mapbox-gl-styles', serveStatic(path.dirname(require.resolve('mapbox-gl-styles')), options));

    staticFolders.forEach(dir => {
        app.use(`/${dir}`, serveStatic(path.join(__dirname, '..', dir), options));
    });

    app.use('/tilesets', tilesets);
    app.post('/write-file', writeFile);
}
