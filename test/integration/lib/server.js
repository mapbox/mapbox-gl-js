import fs from 'fs';
import path from 'path';
import {createServer} from 'http';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';
import st from 'st';
import localizeURLs from './localize-urls.js';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const integrationMount = st({
    index: false,
    path: path.join(__dirname, '..')
});

const mapboxGLStylesMount = st({
    url: '/mapbox-gl-styles',
    path: path.dirname(require.resolve('mapbox-gl-styles')),
    passthrough: true,
    index: false
});

const mapboxMVTFixturesMount = st({
    url: '/mvt-fixtures',
    path: path.dirname(require.resolve('@mapbox/mvt-fixtures')),
    passthrough: true,
    index: false
});

const port = 2900;

export default function () {
    const server = createServer((req, res) => {
        // Write data to disk
        if (req.method === 'POST' && req.url === '/write-file') {
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
        }

        return mapboxMVTFixturesMount(req, res, () => {
            return mapboxGLStylesMount(req, res, () => {
                return integrationMount(req, res);
            });
        });
    });

    return {
        listen(callback) {
            server.listen(port, callback);
        },

        close(callback) {
            server.close(callback);
        },

        localizeURLs(style) {
            return localizeURLs(style, port);
        }
    };
}
