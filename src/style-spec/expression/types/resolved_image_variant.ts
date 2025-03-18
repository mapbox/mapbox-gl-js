import type Color from '../../util/color';

export type ResolvedImageVariantId = string;

export type RasterizationOptions = {
    params?: Record<string, Color>;
    transform?: DOMMatrix;
}

/**
 * `ResolvedImageVariant` is a component of {@link ResolvedImage}
 * that represents either the primary or secondary image
 * along with its rendering configuration.
 *
 * @private
 */
export class ResolvedImageVariant {
    id: ResolvedImageVariantId;
    options: RasterizationOptions;

    constructor(id: ResolvedImageVariantId, options: RasterizationOptions = {}) {
        this.id = id;
        this.options = options;

        if (!options.transform) {
            this.options.transform = new DOMMatrix([1, 0, 0, 1, 0, 0]);
        } else {
            const {a, b, c, d, e, f} = options.transform;
            this.options.transform = new DOMMatrix([a, b, c, d, e, f]);
        }
    }

    serializeId(): string {
        return this.id;
    }

    static parseId(str: string): ResolvedImageVariantId | null {
        const obj = JSON.parse(str) || {};
        return obj.id || null;
    }

    static parse(str: string): ResolvedImageVariant | null {
        const {id, options} = JSON.parse(str) || {};
        if (!id) return null;

        const {a, b, c, d, e, f} = options.transform || {};

        return new ResolvedImageVariant(
            id,
            {params: options.params, transform: new DOMMatrix([a, b, c, d, e, f])}
        );
    }

    serialize(): string {
        const {a, b, c, d, e, f} = this.options.transform;

        const serialized = {
            id: this.id,
            options: {
                params: this.options.params,
                transform: {a, b, c, d, e, f},
            }
        };

        return JSON.stringify(serialized);
    }

    scaleSelf(factor: number): this {
        this.options.transform.scaleSelf(factor);
        return this;
    }
}
