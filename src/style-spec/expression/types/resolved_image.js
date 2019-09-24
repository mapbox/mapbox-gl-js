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

    static fromString(options: ResolvedImageOptions): ResolvedImage {
        return new ResolvedImage(options);
    }

    serialize(): Array<mixed> {
        return ["image", this.name];
    }
}
