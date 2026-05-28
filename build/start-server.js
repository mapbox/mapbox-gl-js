import http from 'http';
import serveStatic from 'serve-static';

const port = 9966;
const host = '0.0.0.0';

const serve = serveStatic('.', {
    index: ['index.html'],
    etag: false,
    lastModified: false,
    maxAge: 0
});

http.createServer((req, res) => {
    serve(req, res, () => {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    });
}).listen(port, host);
