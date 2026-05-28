import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import serveStatic from 'serve-static';
import localizeURLs from './localize-urls.js';
import {defaultOptions, staticFolders, writeFile} from './middlewares.js';

export default function () {
    const port = 3000;
    const mounts = [
        ['/mvt-fixtures', serveStatic(path.dirname(fileURLToPath(import.meta.resolve('@mapbox/mvt-fixtures'))), defaultOptions)],
        ['/mapbox-gl-styles', serveStatic(path.dirname(fileURLToPath(import.meta.resolve('@mapbox/mapbox-gl-styles'))), defaultOptions)],
        ...staticFolders.map((dir) => [`/${dir}`, serveStatic(path.join(import.meta.dirname, '..', dir), defaultOptions)])
    ];

    const server = http.createServer((req, res) => {
        const pathname = req.url.split('?')[0];

        if (req.method === 'POST' && pathname === '/write-file') {
            writeFile(req, res);
            return;
        }

        for (const [prefix, handler] of mounts) {
            if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
                req.url = req.url.slice(prefix.length) || '/';
                handler(req, res, (err) => {
                    const status = err ? (err.status || err.statusCode || 500) : 404;
                    res.writeHead(status, {'Content-Type': 'text/plain'});
                    res.end(err ? (err.message || String(err)) : 'Not Found');
                });
                return;
            }
        }

        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    });

    return {
        listen() {
            return new Promise((resolve) => { server.listen(port, () => resolve()); });
        },

        close() {
            return new Promise((resolve, reject) => {
                if (!server.listening) { resolve(); return; }
                server.close((err) => { if (err) reject(err); else resolve(); });
            });
        },

        localizeURLs(style) {
            return localizeURLs(style, port);
        }
    };
}
