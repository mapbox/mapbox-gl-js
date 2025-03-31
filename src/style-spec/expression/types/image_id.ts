import type {Brand} from '../../types/brand';

export type ImageIdSpec = {
    name: string;
    iconsetId?: string;
};

/**
 * `StringifiedImageId` is a stringified version of the `ImageId`.
 *
 * @private
 */
export type StringifiedImageId = Brand<string, 'ImageId'>;

/**
 * `ImageId` is a reference to an {@link ImageVariant} in the sprite or iconset.
 *
 * @private
 */
export class ImageId {
    name: string;
    iconsetId?: string;

    constructor(id: string | ImageId | ImageIdSpec) {
        if (typeof id === 'string') {
            this.name = id;
        } else {
            this.name = id.name;
            this.iconsetId = id.iconsetId;
        }
    }

    static from(id: string | ImageId | ImageIdSpec): ImageId {
        return new ImageId(id);
    }

    static toString(id: ImageId | ImageIdSpec): StringifiedImageId {
        return JSON.stringify({name: id.name, iconsetId: id.iconsetId}) as StringifiedImageId;
    }

    static parse(str: StringifiedImageId): ImageId | null {
        try {
            const {name, iconsetId} = JSON.parse(str);
            return new ImageId({name, iconsetId});
        } catch (e) {
            return null;
        }
    }

    static isEqual(a: ImageId | ImageIdSpec, b: ImageId | ImageIdSpec): boolean {
        return a.name === b.name && a.iconsetId === b.iconsetId;
    }

    toString(): StringifiedImageId {
        return JSON.stringify({name: this.name, iconsetId: this.iconsetId}) as StringifiedImageId;
    }

    serialize(): ImageIdSpec {
        return {name: this.name, iconsetId: this.iconsetId};
    }
}
