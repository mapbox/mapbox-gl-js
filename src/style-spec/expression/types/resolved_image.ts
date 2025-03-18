import {ImageVariant} from './image_variant';

import type {RasterizationOptions} from './image_variant';

export default class ResolvedImage {
    namePrimary: string;
    optionsPrimary?: RasterizationOptions;
    nameSecondary?: string;
    optionsSecondary: RasterizationOptions;
    available: boolean;

    constructor(
        namePrimary: string,
        optionsPrimary?: RasterizationOptions,
        nameSecondary?: string,
        optionsSecondary?: RasterizationOptions,
        available: boolean = false,
    ) {
        this.namePrimary = namePrimary;
        this.optionsPrimary = optionsPrimary;
        this.nameSecondary = nameSecondary;
        this.optionsSecondary = optionsSecondary;
        this.available = available;
    }

    toString(): string {
        if (this.namePrimary && this.nameSecondary) {
            const primaryId = this.getPrimary().serializeId();
            const secondaryId = this.getSecondary().serializeId();
            return `[${primaryId},${secondaryId}]`;
        }

        return this.getPrimary().serializeId();
    }

    hasPrimary(): boolean {
        return !!this.namePrimary;
    }

    getPrimary(): ImageVariant {
        return new ImageVariant(this.namePrimary, this.optionsPrimary);
    }

    hasSecondary(): boolean {
        return !!this.nameSecondary;
    }

    getSecondary(): ImageVariant | null {
        if (!this.nameSecondary) {
            return null;
        }

        return new ImageVariant(this.nameSecondary, this.optionsSecondary);
    }

    static from(image: string | ResolvedImage): ResolvedImage {
        return typeof image === 'string' ? ResolvedImage.build(image) : image;
    }

    static build(
        namePrimary: string,
        nameSecondary?: string,
        optionsPrimary?: RasterizationOptions,
        optionsSecondary?: RasterizationOptions
    ): ResolvedImage | null {
        if (!namePrimary) return null; // treat empty values as no image
        return new ResolvedImage(namePrimary, optionsPrimary, nameSecondary, optionsSecondary);
    }
}
