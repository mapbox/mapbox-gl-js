import {ImageId} from './image_id';

import type Color from '../../util/color';
import type {Brand} from '../../types/brand';
import type {ImageIdSpec} from './image_id';

/**
 * `StringifiedImageVariant` is a stringified version of the `ImageVariant`.
 *
 * @private
 */
export type StringifiedImageVariant = Brand<string, 'ImageVariant'>;

/**
 * {@link ImageVariant} rasterization options.
 *
 * @private
 */
export type RasterizationOptions = {
    params?: Record<string, Color>;
    transform?: [number, number, number, number, number, number];
};

/**
 * `ImageVariant` is a component of {@link ResolvedImage}
 * that represents either the primary or secondary image
 * along with its rendering configuration.
 *
 * @private
 */
export class ImageVariant {
    id: ImageId;
    options: RasterizationOptions;

    constructor(id: string | ImageIdSpec, options: RasterizationOptions = {}) {
        this.id = ImageId.from(id);
        this.options = Object.assign({transform: [1, 0, 0, 1, 0, 0]}, options);
    }

    toString(): StringifiedImageVariant {
        const serialized = {
            name: this.id.name,
            iconsetId: this.id.iconsetId,
            params: this.options.params,
            transform: this.options.transform,
        };
        return JSON.stringify(serialized) as StringifiedImageVariant;
    }

    static parse(str: StringifiedImageVariant): ImageVariant | null {
        let name, iconsetId, params, transform;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            ({name, iconsetId, params, transform} = JSON.parse(str) || {});
        } catch (e) {
            return null;
        }

        if (!name) return null;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return new ImageVariant({name, iconsetId}, {params, transform});
    }

    scaleSelf(factor: number, yFactor: number = factor): this {
        this.options.transform[0] *= factor;
        this.options.transform[3] *= yFactor;
        return this;
    }
}
