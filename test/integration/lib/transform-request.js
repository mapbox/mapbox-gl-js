/**
 * Transform Mapbox API URLs to localhost URLs for integration tests.
 *
 * This function reverses the URL normalization done by RequestManager:
 * - mapbox:// URLs are normalized to api.mapbox.com by normalize functions
 * - This transforms them back to localhost test paths
 */
export function transformRequest(url, resourceTypeEnum) {
    if (url.startsWith('local://')) {
        return {
            url: url
                .replace('local://mapbox-gl-styles/', `${location.origin}/node_modules/mapbox-gl-styles/`)
                .replace('local://mvt-fixtures/', `${location.origin}/node_modules/@mapbox/mvt-fixtures/`)
                .replace('local://', `${location.origin}/`)
        };
    }

    if (url.startsWith('https://api.mapbox.com')) {
        const baseUrl = url.split('?')[0];
        switch (resourceTypeEnum) {
            case 'Source':
                return {url: baseUrl.replace(/^https:\/\/api\.mapbox\.com\/v4\/(.+)\.json$/, `${location.origin}/tilesets/$1`)};

            case 'Tile':
                return {url: baseUrl.replace(/^https:\/\/api\.mapbox\.com\/(v4|raster\/v1|rasterarrays\/v1|3dtiles\/v1)\/(.+)$/, `${location.origin}/tiles/$2`)};

            case 'Glyphs':
                return {url: baseUrl.replace(/^https:\/\/api\.mapbox\.com\/fonts\/v1\/(.+)$/, `${location.origin}/glyphs/$1`)};

            case 'SpriteJSON':
            case 'SpriteImage': {
                const match = baseUrl.match(/^https:\/\/api\.mapbox\.com\/styles\/v1\/(.+)\/sprite(.*)$/);
                return {url: `${location.origin}/sprites/${match[1]}${match[2]}`};
            }

            default:
                return {url: baseUrl.replace('https://api.mapbox.com/', `${location.origin}/`)};
        }
    }

    return {url};
}
