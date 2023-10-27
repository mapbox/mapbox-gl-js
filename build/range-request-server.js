import st from 'st';
import fs from 'fs';
import { dirname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
const __dirname = dirname(fileURLToPath(import.meta.url));


function formatLog (req, res) {
    return `[${res.statusCode} ${res.statusMessage}] ${req.method.toUpperCase()} ${req.url}`;
}

const port = process.env.PORT || 9966;
const host = process.env.HOST || '0.0.0.0';

// This script implements a basic dev server roughly equivalent in behavior to
// the st-based server already in usage. It implements support for basic HTTP
// range requests. Any other differences in usage with mapbox-gl-js's dev server
// should be consider a bug and should be fixed.

http.createServer((req, res) => {
    // Normalize the request URL and remove any trailing ../ which would allow
    // it to read contents outside the GL JS directory
    const unsafeUrl = normalize(req.url).replace(/^(\.\.(\/|\\|$))+/, '');
    const safeUrl = join(__dirname, '..', unsafeUrl);

    const range = req.headers.range;
    let options = {};
    let start, end;

    if (range) {
        const bytesPrefix = "bytes=";
        if (range.startsWith(bytesPrefix)) {
            const bytesRange = range.substring(bytesPrefix.length);
            const parts = bytesRange.split("-");
            if (parts.length === 2) {
                const rangeStart = parts[0] && parts[0].trim();
                if (rangeStart && rangeStart.length > 0) {
                    options.start = start = parseInt(rangeStart);
                }
                const rangeEnd = parts[1] && parts[1].trim();
                if (rangeEnd && rangeEnd.length > 0) {
                    options.end = end = parseInt(rangeEnd);
                }
            }
        }
    }

    if (/\.mp4$/.test(req.url)) {
        res.setHeader("content-type", "video/mp4");
    }

    fs.stat(safeUrl, (err, stat) => {
        if (err || !stat.isFile()) {
            res.statusCode = 404;
            res.end('Not Found');
            console.error(formatLog(req, res));
            return;
        }

        let contentLength = stat.size;

        if (req.method === "HEAD") {
            res.statusCode = 200;
            res.setHeader("accept-ranges", "bytes");
            res.setHeader("content-length", contentLength);
            console.error(formatLog(req, res));
            res.end();
        } else {
            let retrievedLength;
            if (start !== undefined && end !== undefined) {
                retrievedLength = (end+1) - start;
            }
            else if (start !== undefined) {
                retrievedLength = contentLength - start;
            }
            else if (end !== undefined) {
                retrievedLength = (end+1);
            }
            else {
                retrievedLength = contentLength;
            }

            res.statusCode = start !== undefined || end !== undefined ? 206 : 200;

            retrievedLength = Math.min(retrievedLength, contentLength);
            res.setHeader("content-length", retrievedLength);

            end = Math.min(end, contentLength);

            if (range !== undefined) {
                res.setHeader("content-range", `bytes ${start || 0}-${end || (contentLength-1)}/${contentLength}`);
                res.setHeader("accept-ranges", "bytes");
            }

            const fileStream = fs.createReadStream(safeUrl, options);
            fileStream.on("error", error => {
                console.log(`Error reading file ${safeUrl}.`);
                console.log(error);
                res.statusCode = 500;
                console.error(formatLog(req, res));
            });
            fileStream.on("end", () => {
                console.error(formatLog(req, res));
            });

            fileStream.pipe(res);
        }
    });
}).listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}`);
})
