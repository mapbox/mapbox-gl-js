import type {TileProvider, TileProviderConstructor} from './tile_provider';

const pendingLoads: Map<string, Promise<TileProviderConstructor>> = new Map();
const tileProviders: Map<string, TileProviderConstructor> = new Map();

/**
 * Dynamically imports a provider module and caches its class.
 * Deduplicates concurrent imports for the same provider.
 * On failure the pending entry is cleared so the next call retries —
 * a transient network error should not permanently poison the cache.
 * @private
 */
export async function loadTileProvider(name: string, url: string): Promise<TileProviderConstructor> {
    const cached = tileProviders.get(name);
    if (cached) return cached;

    const pending = pendingLoads.get(name);
    if (pending !== undefined) return pending;

    const load = import(/* @vite-ignore */ url)
        .then((mod: {default?: new (...args: unknown[]) => TileProvider<ArrayBuffer>}) => {
            const TileProviderClass = mod.default;
            if (typeof TileProviderClass !== 'function') {
                throw new Error(`TileProvider "${name}" module must default-export a class`);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (typeof TileProviderClass.prototype.loadTile !== 'function') {
                throw new Error(`TileProvider "${name}" class must have a loadTile method`);
            }
            tileProviders.set(name, TileProviderClass);
            return TileProviderClass;
        })
        .finally(() => {
            pendingLoads.delete(name);
        });

    pendingLoads.set(name, load);
    return load;
}
