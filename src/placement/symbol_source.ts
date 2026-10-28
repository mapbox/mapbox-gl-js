import type {SymbolVariantId} from './types';

export interface SymbolSource {
    // Called after placement is finished when a symbol variant becomes invisible
    hideSymbolVariant: (variantId: SymbolVariantId, placementRunTimestamp: number, fadeDuration: number) => void;
    // Called after placement is finished when a symbol variant becomes visible
    showSymbolVariant: (variantId: SymbolVariantId, placementRunTimestamp: number, fadeDuration: number) => void;
}
