import {ImageVariant} from '../style-spec/expression/types/image_variant';
import {register} from '../util/web_worker_transfer';

import type {StyleImage, StyleImageMap} from '../style/style_image';
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {LUT} from '../util/lut';

type ImageDescriptor = {
    id: string;
    version: number;
    sx: number;
    sy: number;
};

function compareImageDescriptors(a: ImageDescriptor, b: ImageDescriptor): number {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    if (a.version < b.version) return -1;
    if (a.version > b.version) return 1;
    if (a.sx < b.sx) return -1;
    if (a.sx > b.sx) return 1;
    if (a.sy < b.sy) return -1;
    if (a.sy > b.sy) return 1;
    return 0;
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

function combineHash(hash: number, value: number): number {
    return ((hash << 5) - hash) + value;
}

function addDescriptors(images: Map<StringifiedImageVariant, StyleImage>, imageVersions: ImageVersionsMap, descriptors: ImageDescriptor[], variantCache?: Map<StringifiedImageVariant, ImageVariant>) {
    for (const [id] of images.entries()) {
        // Use cached variant if available to avoid re-parsing
        const imageVariant = (variantCache && variantCache.get(id)) || ImageVariant.parse(id);
        const imageId = imageVariant.id.toString();
        const version = imageVersions.get(imageId) || 0;

        // Use the full stringified variant (including color params) as the descriptor id.
        // This ensures atlases built with different LUT-applied colors are never treated
        // as matching, even if the base image name and scale are identical.
        descriptors.push({
            id,
            version,
            sx: imageVariant.sx,
            sy: imageVariant.sy
        });
    }
}

export type ImageVersionsMap = Map<string, number>;

/**
 * Describes the content of an image atlas based on the requested images.
 * Used for caching and reusing atlases with the same content.
 */
export class AtlasContentDescriptor {
    hash: number;
    requiresMipMaps: boolean;

    private iconDescriptors: ImageDescriptor[];
    private patternDescriptors: ImageDescriptor[];

    constructor(
        icons: StyleImageMap<StringifiedImageVariant>,
        patterns: StyleImageMap<StringifiedImageVariant>,
        imageVersions: ImageVersionsMap,
        lut: LUT | null,
        variantCache?: Map<StringifiedImageVariant, ImageVariant>
    ) {
        this.iconDescriptors = [];
        this.patternDescriptors = [];
        // Mipmaps are required when patterns are present
        this.requiresMipMaps = patterns.size > 0;

        // Process icon images
        addDescriptors(icons, imageVersions, this.iconDescriptors, variantCache);

        // Process pattern images
        addDescriptors(patterns, imageVersions, this.patternDescriptors, variantCache);

        // Sort all descriptors to ensure stable hash
        this.iconDescriptors.sort(compareImageDescriptors);
        this.patternDescriptors.sort(compareImageDescriptors);

        // Calculate combined hash
        let seed = 0;
        const lutData = lut ? lut.data : '';
        if (lutData) {
            seed = combineHash(seed, hashCode(lutData));
        }
        seed = combineHash(seed, 1); // separator

        for (const descriptor of this.iconDescriptors) {
            seed = combineHash(seed, hashCode(descriptor.id));
            seed = combineHash(seed, descriptor.version);
            seed = combineHash(seed, descriptor.sx);
            seed = combineHash(seed, descriptor.sy);
        }
        seed = combineHash(seed, 1);
        for (const descriptor of this.patternDescriptors) {
            seed = combineHash(seed, hashCode(descriptor.id));
            seed = combineHash(seed, descriptor.version);
            seed = combineHash(seed, descriptor.sx);
            seed = combineHash(seed, descriptor.sy);
        }
        this.hash = seed;
    }

    /**
     * Checks if this descriptor's content is a subset of another descriptor's content.
     * Returns true if all images in this descriptor are also present in the other descriptor.
     */
    subsetOf(other: AtlasContentDescriptor): boolean {
        return (
            this.isSubsetArray(this.iconDescriptors, other.iconDescriptors, compareImageDescriptors) &&
            this.isSubsetArray(this.patternDescriptors, other.patternDescriptors, compareImageDescriptors)
        );
    }

    /**
     * Checks if one sorted array is a subset of another sorted array.
     * Both arrays must be sorted using the same comparator.
     */
    private isSubsetArray<T>(subset: T[], superset: T[], compareFn: (a: T, b: T) => number): boolean {
        let i = 0;
        let j = 0;
        if (subset.length > superset.length) return false;
        while (i < subset.length && j < superset.length) {
            const cmp = compareFn(subset[i], superset[j]);
            if (cmp === 0) {
                // Found a match, advance both
                i++;
                j++;
            } else if (cmp < 0) {
                // Element in subset is not in superset
                return false;
            } else {
                // Element in superset is larger, advance superset
                j++;
            }
        }
        // Subset is valid if we've matched all elements
        return i === subset.length;
    }

}

register(AtlasContentDescriptor, "AtlasContentDescriptor");
