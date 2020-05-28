import MercatorCoordinate from '../../src/geo/mercator_coordinate';
import {OverscaledTileID} from '../../src/source/tile_id';

export default function locationsWithTileID(locations) {
    return locations.map(feature => {
        const {coordinates} = feature.geometry;
        const {zoom} = feature.properties;
        const {x, y} = MercatorCoordinate.fromLngLat({
            lng: coordinates[0],
            lat: coordinates[1]
        });

        const scale = Math.pow(2, zoom);
        const tileX = Math.floor(x * scale);
        const tileY = Math.floor(y * scale);

        return {
            description: feature.properties['place_name'],
            tileID: [new OverscaledTileID(zoom, 0, zoom, tileX, tileY)],
            zoom,
            center: coordinates
        };
    });
}
