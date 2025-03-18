import {ResolvedImageVariant} from './resolved_image_variant';

import type {RasterizationOptions} from './resolved_image_variant';

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

        if (optionsPrimary) {
            this.optionsPrimary = optionsPrimary;
        }

        if (nameSecondary) {
            this.nameSecondary = nameSecondary;
        }

        if (optionsSecondary) {
            this.optionsSecondary = optionsSecondary;
        }

        this.available = available;
    }

    toString(): string {
        if (this.namePrimary && this.nameSecondary) {
            return `[${this.namePrimary},${this.nameSecondary}]`;
        }

        return this.namePrimary;
    }

    getPrimary(): ResolvedImageVariant {
        const rasterizationOptions = {
            params: this.optionsPrimary && this.optionsPrimary.params,
            transform: this.optionsPrimary && this.optionsPrimary.transform
        };

        return new ResolvedImageVariant(this.namePrimary, rasterizationOptions);
    }

    getSerializedPrimary(): string {
        return this.getPrimary().serialize();
    }

    getSecondary(): ResolvedImageVariant | null {
        if (!this.nameSecondary) {
            return null;
        }

        const rasterizationOptions = {
            params: this.optionsSecondary && this.optionsSecondary.params,
            transform: this.optionsSecondary && this.optionsSecondary.transform
        };

        return new ResolvedImageVariant(this.nameSecondary, rasterizationOptions);
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
