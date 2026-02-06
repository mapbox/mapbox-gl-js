/**
 * S3 Proxy Source for PMTiles
 *
 * Provides S3 access to the PMTiles library via a local proxy server.
 * The proxy (s3-proxy.cjs) handles AWS authentication.
 *
 * The PMTiles library calls getBytes() to fetch byte ranges,
 * which we proxy to S3 via fetch().
 */
class S3ProxySource {
    constructor(s3Path, proxyUrl = 'http://127.0.0.1:9968') {
        // Parse s3://bucket/key format
        const match = s3Path.match(/^s3:\/\/([^\/]+)\/(.+)$/);
        if (!match) {
            throw new Error('Invalid S3 path. Use format: s3://bucket-name/path/to/file');
        }

        this.bucket = match[1];
        this.key = match[2];
        this.proxyUrl = `${proxyUrl}/${this.bucket}/${this.key}`;

        console.log(`[S3ProxySource] Initialized: ${this.proxyUrl}`);
    }

    getKey() {
        return `${this.bucket}/${this.key}`;
    }

    /**
     * Fetch bytes using range request
     * This is the only method PMTiles library needs
     */
    async getBytes(offset, length, signal) {
        const rangeHeader = `bytes=${offset}-${offset + length - 1}`;

        console.log(`[S3ProxySource] Fetching: ${rangeHeader}`);

        const response = await fetch(this.proxyUrl, {
            headers: { 'Range': rangeHeader },
            signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.arrayBuffer();
        console.log(`[S3ProxySource] Received ${data.byteLength} bytes`);

        return {
            data,
            etag: response.headers.get('etag'),
            cacheControl: response.headers.get('cache-control'),
            expires: response.headers.get('expires')
        };
    }
}

// Export to window
window.S3ProxySource = S3ProxySource;
