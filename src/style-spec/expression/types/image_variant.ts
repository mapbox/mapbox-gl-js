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
    transform?: DOMMatrix;
}

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
        this.options = Object.assign({}, options);

        if (!options.transform) {
            this.options.transform = new DOMMatrix([1, 0, 0, 1, 0, 0]);
        } else {
            const {a, b, c, d, e, f} = options.transform;
            this.options.transform = new DOMMatrix([a, b, c, d, e, f]);
        }
    }

    toString(): StringifiedImageVariant {
        const {a, b, c, d, e, f} = this.options.transform;

        const serialized = {
            name: this.id.name,
            iconsetId: this.id.iconsetId,
            params: this.options.params,
            transform: {a, b, c, d, e, f},
        };

        return JSON.stringify(serialized) as StringifiedImageVariant;
    }

    static parse(str: StringifiedImageVariant): ImageVariant | null {
        let name, iconsetId, params, transform;

        try {
            ({name, iconsetId, params, transform} = JSON.parse(str) || {});
        } catch (e) {
            return null;
        }

        if (!name) return null;

        const {a, b, c, d, e, f} = transform || {};
        return new ImageVariant({name, iconsetId}, {params, transform: new DOMMatrix([a, b, c, d, e, f])});
    }

    scaleSelf(factor: number, yFactor?: number): this {
        this.options.transform.scaleSelf(factor, yFactor);
        return this;
    }
}
