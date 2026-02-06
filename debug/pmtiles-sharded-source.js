/**
 * Sharded PMTiles Source
 *
 * Handles PMTiles that are sharded across multiple bundles.
 * Uses @mapbox/mts-sharding-scheme to determine which bundle contains each tile.
 *
 * Example:
 * - URL template: s3://bucket/prefix/{z}/{x}/{y}
 * - Request tile 10/4/5
 * - Sharding maps to shard 2/0/0
 * - Fetch from: s3://bucket/prefix/2/0/0
 *
 * Build: npx browserify debug/pmtiles-sharded-source.js -o debug/pmtiles-sharded-source.bundle.js --standalone ShardedPMTiles
 */

const { MtsShardingScheme } = require('@mapbox/mts-sharding-scheme');

// Embedded v1 sharding config (since browserify doesn't include JSON files)
const V1_CONFIG = {
    "max_zoom_level": 22,
    "sharding_scheme_version": "v1",
    "sharding_scheme": {
        "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0,
        "6": 2, "7": 2, "8": 2, "9": 2, "10": 2,
        "11": 6, "12": 6, "13": 6, "14": 6,
        "15": 8, "16": 8, "17": 8, "18": 8, "19": 8, "20": 8, "21": 8, "22": 8
    }
};

/**
 * Source that handles sharded PMTiles
 * Each tile z/x/y gets mapped to a shard z/x/y which points to a PMTiles bundle
 */
class ShardedPMTilesSource {
    constructor(config) {
        // config should have:
        // - baseUrl: S3 URL template like "s3://bucket/prefix/{z}/{x}/{y}"
        // - shardingConfig: The sharding scheme config (e.g., "v1" or custom config)
        // - proxyUrl: The proxy server URL

        this.baseUrl = config.baseUrl;
        this.proxyUrl = config.proxyUrl || 'http://127.0.0.1:9968';

        // Use embedded config if "v1" is specified, otherwise use provided config
        const shardingConfig = (config.shardingConfig === 'v1' || !config.shardingConfig)
            ? V1_CONFIG
            : config.shardingConfig;

        this.shardingScheme = new MtsShardingScheme(shardingConfig);

        // Cache of PMTiles instances per shard
        this.pmtilesCache = new Map();

        console.log(`[ShardedPMTilesSource] Initialized with sharding scheme:`, {
            baseUrl: this.baseUrl,
            shardCount: this.shardingScheme.shardCount
        });
    }

    /**
     * Get the PMTiles instance for a specific tile
     * Uses sharding to determine which bundle contains the tile
     */
    getPMTilesForTile(z, x, y) {
        // Get the shard coordinates for this tile
        const [shardZ, shardX, shardY] = this.shardingScheme.getShardZXY(z, x, y);
        const shardKey = `${shardZ}/${shardX}/${shardY}`;

        console.log(`[ShardedPMTilesSource] Tile ${z}/${x}/${y} → Shard ${shardKey}`);

        // Check if we already have a PMTiles instance for this shard
        if (this.pmtilesCache.has(shardKey)) {
            return this.pmtilesCache.get(shardKey);
        }

        // Create the S3 URL for this shard
        const s3Url = this.baseUrl
            .replace('{z}', shardZ)
            .replace('{x}', shardX)
            .replace('{y}', shardY);

        console.log(`[ShardedPMTilesSource] Creating PMTiles for shard: ${s3Url}`);

        // Create a proxy source for this specific PMTiles file
        const proxySource = new S3ProxySource(s3Url, this.proxyUrl);

        // Create PMTiles instance
        const pmtiles = new window.pmtilesLib.PMTiles(proxySource);

        // Cache it
        this.pmtilesCache.set(shardKey, pmtiles);

        return pmtiles;
    }

    /**
     * Get header - just get it from the first shard we encounter
     */
    async getHeader() {
        // For now, get header from shard 0/0/0
        const pmtiles = this.getPMTilesForTile(0, 0, 0);
        return await pmtiles.getHeader();
    }

    /**
     * Get a specific tile z/x/y
     */
    async getZxy(z, x, y, signal) {
        const pmtiles = this.getPMTilesForTile(z, x, y);
        return await pmtiles.getZxy(z, x, y, signal);
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.ShardedPMTilesSource = ShardedPMTilesSource;
}

// Also export for Node.js bundling
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShardedPMTilesSource };
}
