#!/usr/bin/env node
/**
 * Simple S3 proxy server that uses AWS credentials from environment
 * Run: mbx env default && node debug/s3-proxy.cjs
 *
 * This allows the browser to access S3 with your AWS credentials
 * without exposing them in the browser.
 */

const http = require('http');
const AWS = require('aws-sdk');

const PORT = 9968;

// Configure S3 client - credentials come from environment (mbx env default)
const s3 = new AWS.S3({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT,
    maxRetries: 4,
    httpOptions: {
        timeout: 120000
    }
});

const server = http.createServer(async (req, res) => {
    console.log('\n=== Incoming Request ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    // Parse URL: /bucket-name/key/path
    const match = req.url.match(/^\/([^\/]+)\/(.+)$/);

    if (!match) {
        console.log('ERROR: Invalid URL format');
        res.writeHead(400, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
        });
        res.end('Invalid URL. Use: /bucket-name/key/path');
        return;
    }

    const bucket = match[1];
    const key = decodeURIComponent(match[2]);

    console.log(`Parsed - Bucket: ${bucket}`);
    console.log(`Parsed - Key: ${key}`);
    console.log(`S3 request: s3://${bucket}/${key}`);

    const params = {
        Bucket: bucket,
        Key: key
    };

    // Handle range requests
    if (req.headers.range) {
        params.Range = req.headers.range;
        console.log(`  Range: ${req.headers.range}`);
    }

    // Handle conditional requests
    if (req.headers['if-match']) {
        params.IfMatch = req.headers['if-match'];
    }
    if (req.headers['if-none-match']) {
        params.IfNoneMatch = req.headers['if-none-match'];
    }

    try {
        const expected400s = [403, 404, 412, 416];

        console.log('Sending S3 request with params:', JSON.stringify(params, null, 2));

        const s3Request = s3.getObject(params)
            .on('httpHeaders', function(statusCode, headers) {
                console.log(`S3 Response Status: ${statusCode}`);
                console.log(`S3 Response Headers:`, JSON.stringify(headers, null, 2));

                // Set CORS headers
                const responseHeaders = {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, ETag, Accept-Ranges',
                    'Accept-Ranges': 'bytes'
                };

                // Copy relevant S3 headers
                if (headers['content-type']) responseHeaders['Content-Type'] = headers['content-type'];
                if (headers['content-length']) responseHeaders['Content-Length'] = headers['content-length'];
                if (headers['content-range']) responseHeaders['Content-Range'] = headers['content-range'];
                if (headers['etag']) responseHeaders['ETag'] = headers['etag'];
                if (headers['last-modified']) responseHeaders['Last-Modified'] = headers['last-modified'];
                if (headers['cache-control']) responseHeaders['Cache-Control'] = headers['cache-control'];

                res.writeHead(statusCode, responseHeaders);

                if (statusCode === 200 || statusCode === 206) {
                    // Stream the response
                    this.response.httpResponse.createUnbufferedStream().pipe(res);
                }
            })
            .on('httpDone', (response) => {
                const statusCode = response.httpResponse.statusCode;

                if (statusCode !== 200 && statusCode !== 206) {
                    // Handle error responses
                    if (statusCode === 416) {
                        // Handle range not satisfiable
                        const body = response.httpResponse.body.toString();
                        const match = body.match(/<ActualObjectSize>\s*(\d+)\s*<\/ActualObjectSize>/);
                        if (match) {
                            res.setHeader('Content-Range', `bytes */${match[1]}`);
                        }
                    }
                    res.end();
                }
            })
            .on('error', (err) => {
                console.error('\n=== S3 ERROR ===');
                console.error('Error message:', err.message);
                console.error('Error code:', err.code);
                console.error('Status code:', err.statusCode);
                console.error('Full error:', err);

                if (expected400s.includes(err.statusCode)) {
                    res.writeHead(err.statusCode, {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'text/plain'
                    });
                    res.end(err.message);
                } else {
                    res.writeHead(500, {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'text/plain'
                    });
                    res.end('Internal server error');
                }
            });

        s3Request.send();

    } catch (error) {
        console.error('\n=== CATCH ERROR ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
        });
        res.end('Internal server error');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`S3 proxy server running at http://127.0.0.1:${PORT}/`);
    console.log(`Usage: http://127.0.0.1:${PORT}/bucket-name/key/path`);
    console.log(`\nMake sure to run: mbx env default`);
    console.log(`AWS credentials: ${process.env.AWS_ACCESS_KEY_ID ? 'Found' : 'NOT FOUND'}`);
});
