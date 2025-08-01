import {clamp} from '../util/util';
import browser from '../util/browser';

import type SourceCache from '../source/source_cache';
import type Tile from '../source/tile';
import type Transform from '../geo/transform';

export type RasterFade = {
    opacity: number;
    mix: number;
    isFading: boolean;
};

function rasterFade(
    tile: Tile,
    parentTile: Tile | null | undefined,
    sourceCache: SourceCache,
    transform: Transform,
    fadeDuration: number,
): RasterFade {
    if (fadeDuration > 0) {
        const now = browser.now();
        const sinceTile = (now - tile.timeAdded) / fadeDuration;
        const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

        const source = sourceCache.getSource();
        const idealZ = transform.coveringZoomLevel({
            tileSize: source.tileSize,
            roundZoom: source.roundZoom
        });

        // if no parent or parent is older, fade in; if parent is younger, fade out
        const fadeIn = !parentTile || Math.abs(parentTile.tileID.overscaledZ - idealZ) > Math.abs(tile.tileID.overscaledZ - idealZ);

        const childOpacity = (fadeIn && tile.refreshedUponExpiration) ? 1 : clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);

        if (parentTile) {
            return {
                opacity: 1,
                mix: 1 - childOpacity,
                isFading: sinceTile < 1
            };
        } else {
            return {
                opacity: childOpacity,
                mix: 0,
                isFading: sinceTile < 1
            };
        }
    } else {
        return {
            opacity: 1,
            mix: 0,
            isFading: false
        };
    }
}

export default rasterFade;
