# @mapbox/mapbox-gl-pmtiles-provider

PMTiles tile provider for Mapbox GL JS. Implements the `TileProvider` interface to read vector tiles directly from [PMTiles](https://github.com/protomaps/PMTiles) archives.

## Development

```bash
npm run build   # Build the bundle
npm test        # Run unit tests
```

## Publishing to CDN

1. Bump `version` in `package.json`
2. Update the default CDN URL in GL JS `TILE_PROVIDER_URLS` config
3. Build and upload:

```bash
npm run build
./publish_cdn.sh --dry-run  # Preview commands
./publish_cdn.sh            # Requires AWS credentials
```

Uploads to `http://api.mapbox.com/mapbox-gl-js/mapbox-gl-pmtiles-provider-v{version}.js` with immutable cache headers.
