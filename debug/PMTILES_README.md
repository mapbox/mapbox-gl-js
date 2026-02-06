# PMTiles from S3 (Browser)

Load sharded PMTiles from S3 in the browser, using the same approach as `@mapbox/core-tiles`.

## Quick Start

```bash
# Terminal 1: Start S3 proxy (provides AWS credentials)
mbx env default
node debug/s3-proxy.cjs

# Terminal 2: Start dev server
npm run start-debug

# Browser: Open with tilesetId and jobId
http://localhost:9966/debug/pmtiles.html?tilesetId=<TILESET_ID>&jobId=<JOB_ID>

```

## How It Works

**Sharded PMTiles**: Tiles are split across multiple PMTiles files (shards) for better performance.

Example:
- URL template: `s3://bucket/prefix/{z}/{x}/{y}`
- Request tile 10/4/5
- Sharding scheme maps to shard 2/0/0
- Fetch from: `s3://bucket/prefix/2/0/0` (actual PMTiles file)
- PMTiles library reads tile from that bundle

## Files

### Required
- **`pmtiles-lib.js`** - Official PMTiles library (reads PMTiles format)
- **`pmtiles-s3-loader.js`** - S3 proxy source wrapper (~60 lines)
- **`pmtiles-sharded-source.js`** - Sharding source (~80 lines)
- **`pmtiles-sharded-source.bundle.js`** - Browserified bundle of above
- **`s3-proxy.cjs`** - Node.js proxy for AWS credentials
- **`pmtiles.html`** - Test page

### Optional
- **`firenze.pmtiles`** - Sample PMTiles file for local testing

## Architecture

```
Map requests tile
  ↓
ShardedPMTilesSource (determines which shard/bundle)
  ↓
PMTiles library (reads header, directories, tiles)
  ↓
S3ProxySource (fetches bytes via range requests)
  ↓
fetch() → s3-proxy.cjs → S3
```

## Rebuild Sharding Bundle

If you modify `pmtiles-sharded-source.js`:

```bash
npx browserify debug/pmtiles-sharded-source.js -o debug/pmtiles-sharded-source.bundle.js --standalone ShardedPMTiles
```

## What is Sharding?

Instead of one giant PMTiles file:
- Low zooms (0-5): Few tiles → 1 shard
- Mid zooms (6-10): More tiles → 4 shards
- High zooms (11-14): Many tiles → 36 shards
- Very high zooms (15-22): Millions of tiles → 64 shards

The sharding scheme (`v1`) determines which shard contains each tile.
