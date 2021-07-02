// @flow

export type ResolvedImageOptions = {
    name: string,
    available: boolean
};

export default class ResolvedImage {
    name: string;
    available: boolean;

    constructor(options: ResolvedImageOptions) {
        this.name = options.name;
        this.available = options.available;
    }

    toString(): string {
        return this.name;
    }

    static fromString(name: string): ResolvedImage | null {
        if (!name) return null; // treat empty values as no image
        return new ResolvedImage({name, available: false});
    }

    serialize(): Array<string> {
        return ["image", this.name];
    }
}
