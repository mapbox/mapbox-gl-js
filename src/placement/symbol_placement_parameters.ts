import type Transform from '../geo/transform';
import type BuildingIndex from '../source/building_index';
import type {FogState} from '../style/fog_helpers';
import type {GlobalPlacement} from './global_placement';
import type {SymbolIdRangeAllocator} from './symbol_id_range_allocator';
import type {ReplacementSource} from '../../3d-style/source/replacement_source';

/**
 * Orders of the explicit placement groups, keyed by the `placement-group` layer's fqid
 */
export type PlacementGroupOrders = Map<string, number>;

// Number of placement-subgroups reserved per placement group: one each for optional icons,
// optional texts, and mandatory parts
const SUBGROUPS_PER_PLACEMENT_GROUP = 3;

export function subgroupOrderForLayerPosition(layerPosition: number): number {
    return layerPosition * SUBGROUPS_PER_PLACEMENT_GROUP;
}

// Renderer-side state shared by every layer within one placement run
export type SymbolPlacementParameters = {
    globalPlacement: GlobalPlacement;
    idRangeAllocator: SymbolIdRangeAllocator;
    transform: Transform;
    buildingIndex: BuildingIndex;
    fogState: FogState | null;
    groupOrders: PlacementGroupOrders;
    replacementSource: ReplacementSource;
};
