(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ShardedPMTiles = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{"@mapbox/mts-sharding-scheme":2}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MtsShardingScheme = void 0;
const error_1 = require("./util/error");
const load_1 = require("./util/load");
class MtsShardingScheme {
    constructor(config) {
        switch (typeof config) {
            case 'object':
                this.config = (0, load_1.verifyConfig)(config);
                break;
            case 'string':
                this.config = (0, load_1.loadConfig)(config);
                break;
            default:
                throw new error_1.ShardingError('Invalid or missing config - must provide a config dictionary or a version string.', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
        }
        // count number of shard
        let maxKey = -1;
        let shardCount = 0;
        // NOTE: In JS, there is no order guarantee in object property iteration, however, the order tends to be correct.
        // SEE: https://stackoverflow.com/questions/5525795/does-javascript-guarantee-object-property-order
        const orderedZoomLevels = Object.entries(this.config.sharding_scheme)
            .map(([z, projectedZ]) => [parseInt(z, 10), projectedZ])
            .sort((a, b) => {
            switch (true) {
                case a[0] > b[0]:
                    return 1;
                // NOTE: The lines below might not be covered in all the browsers (default means invalid config).
                case a[0] < b[0]:
                    return -1;
                default:
                    return 0;
            }
        });
        this.cumulativeShardCount = orderedZoomLevels.reduce((acc, projection, i) => {
            if (acc.has(projection[1])) {
                return acc;
            }
            acc.set(projection[1], i === 0 ? 0 : acc.get(maxKey) + Math.pow(4, maxKey));
            maxKey = projection[1];
            shardCount += Math.pow(4, projection[1]);
            return acc;
        }, new Map());
        this.shardCount = shardCount;
    }
    /**
     * Validates the input tile coordinates.
     *
     * @param z {number}  The tile's zoom level.
     * @param x {number}  The tile's X coordinate.
     * @param y {number}  The tile's Y coordinate.
     *
     * @throws {ShardingError}  When any of the coordinates is invalid.
     */
    verifyTile(z, x, y) {
        if (!Number.isInteger(z) || z < 0 || z > this.config.max_zoom_level) {
            throw new error_1.ShardingError(`Invalid zoom level ${z}`, error_1.ShardingErrorCode.INPUT_VALIDATION_ERROR);
        }
        const maxVal = (1 << z) - 1;
        if (!Number.isInteger(x) || x < 0 || x > maxVal) {
            throw new error_1.ShardingError(`Invalid x index ${x}.`, error_1.ShardingErrorCode.INPUT_VALIDATION_ERROR);
        }
        if (!Number.isInteger(y) || y < 0 || y > maxVal) {
            throw new error_1.ShardingError(`Invalid x index ${x}.`, error_1.ShardingErrorCode.INPUT_VALIDATION_ERROR);
        }
    }
    /**
     * Returns the shard z, x, y of a tile.
     *
     * @param tileZ {number}  The tile's zoom level.
     * @param tileX {number}  The tile's X coordinate.
     * @param tileY {number}  The tile's Y coorindate.
     *
     * @returns {[number, number, number]}  The shard's Z-X-Y coordinates
     */
    getShardZXY(tileZ, tileX, tileY) {
        this.verifyTile(tileZ, tileX, tileY);
        const shardZ = this.config.sharding_scheme[tileZ];
        // multiplier for one side of a square
        const projectionDistance = tileZ - shardZ;
        return [shardZ, tileX >> projectionDistance, tileY >> projectionDistance];
    }
    /**
     * Returns a sequential id between 0 ~ this.nbShards-1 for a shard.
     *
     * @param shardZ {number}   The shard's zoom level.
     * @param shardX {number}   The shard's X coordinate.
     * @param shardY {number}   The shard's Y coordinate.
     *
     * @returns {number}        The shard's sequential id.
     *
     * @throws {ShardingError}  When the shard's coordinates are invalid.
     */
    shardZXYtoSequentialId(shardZ, shardX, shardY) {
        this.verifyTile(shardZ, shardX, shardY);
        if (!this.cumulativeShardCount.has(shardZ)) {
            throw new error_1.ShardingError(`Invalid sharding zoom level index ${shardZ}.`, error_1.ShardingErrorCode.INPUT_VALIDATION_ERROR);
        }
        const maxVal = 1 << shardZ;
        return (this.cumulativeShardCount.get(shardZ) +
            shardX * maxVal +
            shardY);
    }
    /**
     * Given a sequential id between 0 ~ this.nbShards-1, return the corresponding shard z, x, y.
     *
     * @param sequentialId {number}   The shard's sequential id.
     *
     * @returns {[number, number, number]}  The shard's Z, X, Y coordinates.
     *
     * @throws {ShardingError}  When the sequential id is invalid.
     */
    sequentialIdToShardZXY(sequentialId) {
        if (!Number.isInteger(sequentialId) ||
            sequentialId < 0 ||
            sequentialId >= this.shardCount) {
            throw new error_1.ShardingError(`Invalid partition id ${sequentialId}.`, error_1.ShardingErrorCode.INPUT_VALIDATION_ERROR);
        }
        const entries = Array.from(this.cumulativeShardCount).reverse();
        let [shardZ, cumCount] = entries[0];
        for (let i = 1; i < entries.length && cumCount > sequentialId; i += 1) {
            [shardZ, cumCount] = entries[i];
        }
        const remainder = sequentialId - cumCount;
        const maxVal = 1 << shardZ;
        return [shardZ, remainder >> shardZ, remainder % maxVal];
    }
}
exports.MtsShardingScheme = MtsShardingScheme;

},{"./util/error":3,"./util/load":4}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardingError = exports.ShardingErrorCode = void 0;
// NOTE: Although, the sued codes might resemble to HTTP error codes, they are not
var ShardingErrorCode;
(function (ShardingErrorCode) {
    // 400 intends to mark external / request issue
    ShardingErrorCode[ShardingErrorCode["INPUT_VALIDATION_ERROR"] = 400] = "INPUT_VALIDATION_ERROR";
    // 500 intends to mark internal issue
    ShardingErrorCode[ShardingErrorCode["GENERIC_ERROR"] = 500] = "GENERIC_ERROR";
    ShardingErrorCode[ShardingErrorCode["CONFIGURATION_ERROR"] = 501] = "CONFIGURATION_ERROR";
})(ShardingErrorCode = exports.ShardingErrorCode || (exports.ShardingErrorCode = {}));
class ShardingError extends Error {
    constructor(error, errorCode = ShardingErrorCode.GENERIC_ERROR) {
        super(error);
        this.errorCode = errorCode;
    }
}
exports.ShardingError = ShardingError;

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.verifyConfig = void 0;
const error_1 = require("./error");
const MAX_ZOOM_LEVEL = 22;
const RESOURCE_DIR = '../../mts_sharding_scheme_config';
const CONFIG_CACHE = {};
/**
 * Validates the provided projection sharding object
 *
 * @param {MtsShardingConfig} config  Object of sharding configuration.
 * @returns {MtsShardingConfig}       The sharding configuration object.
 * @throws {ShardingError}            If the config is malformed.
 */
function verifyConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new error_1.ShardingError('Invalid config format.', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
    }
    if (!config['max_zoom_level']) {
        throw new error_1.ShardingError('Missing max_zoom_level in config', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
    }
    if (!Number.isInteger(config['max_zoom_level']) ||
        config['max_zoom_level'] < 0 ||
        config['max_zoom_level'] > MAX_ZOOM_LEVEL) {
        throw new error_1.ShardingError(`Invalid max_zoom_level ${config['max_zoom_level']}`, error_1.ShardingErrorCode.CONFIGURATION_ERROR);
    }
    if (!config['sharding_scheme_version']) {
        throw new error_1.ShardingError('Invalid sharding_scheme_version in config.', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
    }
    if (!config['sharding_scheme'] ||
        typeof config['sharding_scheme'] !== 'object') {
        throw new error_1.ShardingError('Invalid sharding_scheme in config.', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
    }
    for (let i = 0; i <= config['max_zoom_level']; i += 1) {
        const strI = i.toString();
        if (!Object.prototype.hasOwnProperty.call(config['sharding_scheme'], strI)) {
            throw new error_1.ShardingError(`Missing zoom level ${strI} in sharding scheme.`, error_1.ShardingErrorCode.CONFIGURATION_ERROR);
        }
        if (!Number.isInteger(config['sharding_scheme'][strI]) ||
            config['sharding_scheme'][strI] < 0 ||
            config['sharding_scheme'][strI] > i) {
            throw new error_1.ShardingError(`Invalid projected zoom level '${config['sharding_scheme'][strI]}' for zoom level ${i}.`, error_1.ShardingErrorCode.CONFIGURATION_ERROR);
        }
    }
    if (Object.getOwnPropertyNames(config['sharding_scheme']).length >
        config['max_zoom_level'] + 1) {
        throw new error_1.ShardingError('sharding_scheme cannot contain more zoom levels than max_zoom_level.', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
    }
    return config;
}
exports.verifyConfig = verifyConfig;
/**
 * Returns a sharding configuration
 *
 * @param version {string}      Sharding scheme version to load.
 * @returns {MtsShardingConfig} Sharding configuration object.
 * @throws {ShardingError}      If the config is malformed.
 */
function loadConfig(version) {
    if (CONFIG_CACHE[version]) {
        return CONFIG_CACHE[version];
    }
    const configFile = `${RESOURCE_DIR}/${version}.json`;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        CONFIG_CACHE[version] = verifyConfig(require(configFile));
        return CONFIG_CACHE[version];
    }
    catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            throw new error_1.ShardingError('Configuration not found', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
        }
        else if (e instanceof SyntaxError) {
            throw new error_1.ShardingError('Configuration is not a valid JSON', error_1.ShardingErrorCode.CONFIGURATION_ERROR);
        }
        throw e;
    }
}
exports.loadConfig = loadConfig;

},{"./error":3}]},{},[1])(1)
});
