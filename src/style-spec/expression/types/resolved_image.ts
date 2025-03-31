import {ImageId} from './image_id';
import {ImageVariant} from './image_variant';

import type {ImageIdSpec} from './image_id';
import type {RasterizationOptions} from './image_variant';

export default class ResolvedImage {
    primaryId: ImageId;
    primaryOptions?: RasterizationOptions;
    secondaryId?: ImageId;
    secondaryOptions?: RasterizationOptions;
    available: boolean;

    constructor(
        primaryId: string | ImageIdSpec,
        primaryOptions?: RasterizationOptions,
        secondaryId?: string | ImageIdSpec,
        secondaryOptions?: RasterizationOptions,
        available: boolean = false,
    ) {
        this.primaryId = ImageId.from(primaryId);
        this.primaryOptions = primaryOptions;
        if (secondaryId) this.secondaryId = ImageId.from(secondaryId);
        this.secondaryOptions = secondaryOptions;
        this.available = available;
    }

    toString(): string {
        if (this.primaryId && this.secondaryId) {
            const primaryName = this.primaryId.name;
            const secondaryName = this.secondaryId.name;
            return `[${primaryName},${secondaryName}]`;
        }

        return this.primaryId.name;
    }

    hasPrimary(): boolean {
        return !!this.primaryId;
    }

    getPrimary(): ImageVariant {
        return new ImageVariant(this.primaryId, this.primaryOptions);
    }

    hasSecondary(): boolean {
        return !!this.secondaryId;
    }

    getSecondary(): ImageVariant | null {
        if (!this.secondaryId) {
            return null;
        }

        return new ImageVariant(this.secondaryId, this.secondaryOptions);
    }

    static from(image: string | ResolvedImage): ResolvedImage {
        return typeof image === 'string' ? ResolvedImage.build({name: image}) : image;
    }

    static build(
        primaryId: string | ImageIdSpec,
        secondaryId?: string | ImageIdSpec,
        primaryOptions?: RasterizationOptions,
        secondaryOptions?: RasterizationOptions
    ): ResolvedImage | null {
        if (!primaryId || (typeof primaryId === 'object' && !('name' in primaryId))) return null; // treat empty values as no image
        return new ResolvedImage(primaryId, primaryOptions, secondaryId, secondaryOptions);
    }
}
