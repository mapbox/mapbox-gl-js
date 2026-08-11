import type Painter from './painter';
import type Style from '../style/style';
import type {Elevation} from '../terrain/elevation';
import type {Terrain} from '../terrain/terrain';

// `ITerrainRenderer` is a subset of `Terrain` that core (always-bundled) is allowed to depend on.
// `Elevation` provides `exaggeration`, `findDEMTileFor` and `getMinMaxForTile`.
export type ITerrainRenderer =
    Elevation &
    // Readonly
    Readonly<Pick<Terrain,
        | 'renderingToTexture' | 'enabled'
        | 'gridBuffer' | 'gridIndexBuffer' | 'gridSegments' | 'drapeBufferSize'
        | 'sourceCache' | 'proxySourceCache' | 'proxyCoords'
    >> &
    // Methods
    Pick<Terrain,
        | 'update' | 'updateTileBinding'
        | 'renderBatch' | 'postRender' | 'prepareDrawTile'
        | 'setupElevationDraw' | 'stencilModeForRTTOverlap' | 'clipOrMaskOverlapStencilType'
        | '_clearRenderCacheForTile' | 'resetTileLookupCache' | 'getScaledDemTileSize'
        | 'attenuationRange' | 'getDemUpscale'
        | 'destroy'
    > &
    // Other assignments
    Pick<Terrain, 'framebufferCopyTexture' | 'invalidateRenderCache'>;

export interface ITerrainRendererFactory {
    create: (painter: Painter, style: Style) => ITerrainRenderer;
}

let _factory: ITerrainRendererFactory | null = null;
const _onAvailableCallbacks: Array<() => void> = [];

export function registerTerrainRenderer(factory: ITerrainRendererFactory): void {
    _factory = factory;
    for (const cb of _onAvailableCallbacks.splice(0)) cb();
}

export function createTerrainRenderer(painter: Painter, style: Style): ITerrainRenderer | null {
    return _factory ? _factory.create(painter, style) : null;
}

/**
 * Register a callback to be invoked when the terrain renderer factory becomes
 * available (i.e. when Lite module finishes loading). If the factory is
 * already registered the callback is called immediately.
 */
export function onTerrainRendererAvailable(callback: () => void): void {
    if (_factory) {
        callback();
    } else {
        _onAvailableCallbacks.push(callback);
    }
}
