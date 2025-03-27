import type {Brand} from '../../types/brand';

const separator = '\u001F';

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
        return (id.iconsetId ? `${id.name}${separator}${id.iconsetId}` : id.name) as StringifiedImageId;
    }

    static parse(str: StringifiedImageId): ImageId | null {
        const [name, iconsetId] = str.split(separator);
        return new ImageId({name, iconsetId});
    }

    static isEqual(a: ImageId | ImageIdSpec, b: ImageId | ImageIdSpec): boolean {
        return a.name === b.name && a.iconsetId === b.iconsetId;
    }

    toString(): StringifiedImageId {
        return ImageId.toString(this);
    }

    serialize(): ImageIdSpec {
        return {name: this.name, iconsetId: this.iconsetId};
    }
}
