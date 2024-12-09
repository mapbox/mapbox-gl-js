import {ImageIdWithOptions} from "./image_id_with_options";

import type Color from "../../util/color";

export type RasterizationOptions = {
    params: Record<string, Color>;
    transform?: DOMMatrix;
}

export type ResolvedImageOptions = {
    namePrimary: string;
    optionsPrimary: RasterizationOptions | null | undefined;
    nameSecondary: string | null | undefined;
    optionsSecondary: RasterizationOptions | null | undefined;
    available: boolean;
};

export default class ResolvedImage {
    namePrimary: string;
    optionsPrimary: RasterizationOptions | null | undefined;
    nameSecondary: string | null | undefined;
    optionsSecondary: RasterizationOptions | null | undefined;
    available: boolean;

    constructor(options: ResolvedImageOptions) {
        this.namePrimary = options.namePrimary;
        if (options.nameSecondary) {
            this.nameSecondary = options.nameSecondary;
        }
        if (options.optionsPrimary) {
            this.optionsPrimary = options.optionsPrimary;
        }
        if (options.optionsSecondary) {
            this.optionsSecondary = options.optionsSecondary;
        }
        this.available = options.available;
    }

    toString(): string {
        if (this.namePrimary && this.nameSecondary) {
            return `[${this.namePrimary},${this.nameSecondary}]`;
        }

        return this.namePrimary;
    }

    getPrimary(): ImageIdWithOptions {
        return new ImageIdWithOptions(this.namePrimary, {
            params: this.optionsPrimary ? (this.optionsPrimary.params || {}) : {},
        });
    }

    getSerializedPrimary(): string {
        return this.getPrimary().serialize();
    }

    getSecondary(): ImageIdWithOptions | null {
        if (this.nameSecondary) {
            return new ImageIdWithOptions(this.nameSecondary, {
                params: this.optionsSecondary ? (this.optionsSecondary.params || {}) : {},
            });
        }

        return null;
    }

    static from(image: string | ResolvedImage): ResolvedImage {
        return typeof image === 'string' ? ResolvedImage.build(image) : image;
    }

    static build(
        namePrimary: string,
        nameSecondary?: string | null,
        optionsPrimary?: RasterizationOptions | null,
        optionsSecondary?: RasterizationOptions | null
    ): ResolvedImage | null {
        if (!namePrimary) return null; // treat empty values as no image
        return new ResolvedImage({namePrimary, nameSecondary, optionsPrimary, optionsSecondary, available: false});
    }
}
