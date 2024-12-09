import type {RasterizationOptions} from "./resolved_image";

export class ImageIdWithOptions {
    id: string;
    options: RasterizationOptions;

    constructor(id: string, options?: RasterizationOptions) {
        this.id = id;
        this.options = options || {params: {}};

        if (!this.options.transform) {
            this.options.transform = new DOMMatrix([1, 0, 0, 1, 0, 0]);
        } else {
            const {a, b, c, d, e, f} = this.options.transform;
            this.options.transform = new DOMMatrix([a, b, c, d, e, f]);
        }
    }

    static deserializeFromString(serialized: string): ImageIdWithOptions {
        const deserializedObject = JSON.parse(serialized);
        const options: RasterizationOptions = {params: deserializedObject.options.params};

        const {a, b, c, d, e, f} = deserializedObject.options.transform;

        options.transform = new DOMMatrix([a, b, c, d, e, f]);

        return new ImageIdWithOptions(deserializedObject.id, deserializedObject.options);
    }

    scaleSelf(factor: number): this {
        this.options.transform = this.options.transform.scale(factor);
        return this;
    }

    serialize(): string {
        const serialisedObject: Record<string, any> = {
            id: this.id,
        };

        if (this.options) {
            serialisedObject.options = this.options;
        }

        const {
            a, b, c, d, e, f,
        } = this.options.transform;

        serialisedObject.options.transform = {
            a, b, c, d, e, f,
        };

        return JSON.stringify(serialisedObject);
    }
}
