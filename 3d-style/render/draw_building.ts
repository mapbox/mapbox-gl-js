import type BuildingStyleLayer from '../style/style_layer/building_style_layer';
import type SourceCache from '../../src/source/source_cache';
import type Painter from '../../src/render/painter';
import type {OverscaledTileID} from '../../src/source/tile_id';

export default draw;

function draw(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, coords: Array<OverscaledTileID>) {

}
