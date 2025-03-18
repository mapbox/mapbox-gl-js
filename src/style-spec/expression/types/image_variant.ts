import type Color from '../../util/color';

export type ImageVariantId = string;

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
    _id: ImageVariantId;
    options: RasterizationOptions;

    constructor(id: ImageVariantId, options: RasterizationOptions = {}) {
        this._id = id;
        this.options = Object.assign({}, options);

        if (!options.transform) {
            this.options.transform = new DOMMatrix([1, 0, 0, 1, 0, 0]);
        } else {
            const {a, b, c, d, e, f} = options.transform;
            this.options.transform = new DOMMatrix([a, b, c, d, e, f]);
        }
    }

    serializeId(): string {
        return this._id;
    }

    static parseId(str: string): ImageVariantId | null {
        const obj = JSON.parse(str) || {};
        return obj.id || null;
    }

    static parse(str: string): ImageVariant | null {
        const {id, params, transform} = JSON.parse(str) || {};
        if (!id) return null;

        const {a, b, c, d, e, f} = transform || {};
        return new ImageVariant(id, {params, transform: new DOMMatrix([a, b, c, d, e, f])});
    }

    serialize(): string {
        const {a, b, c, d, e, f} = this.options.transform;

        const serialized = {
            id: this._id,
            params: this.options.params,
            transform: {a, b, c, d, e, f},
        };

        return JSON.stringify(serialized);
    }

    scaleSelf(factor: number): this {
        this.options.transform.scaleSelf(factor);
        return this;
    }
}
