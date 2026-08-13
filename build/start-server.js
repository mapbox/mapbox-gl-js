import http from 'http';
import serveStatic from 'serve-static';
import {renderCatalog} from './generate-debug-index.ts';

const port = 9966;
const host = '0.0.0.0';

const serve = serveStatic('.', {
    index: ['index.html'],
    etag: false,
    lastModified: false,
    maxAge: 0
});

// The debug catalog is rendered per request (a few ms) rather than served from disk,
// so pages added or annotated while the server is running show up on reload.
const catalogPaths = new Set(['/debug/', '/debug/index.html']);

http.createServer((req, res) => {
    if (catalogPaths.has(req.url.split('?')[0])) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
        res.end(renderCatalog());
        return;
    }

    serve(req, res, () => {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    });
}).listen(port, host);
