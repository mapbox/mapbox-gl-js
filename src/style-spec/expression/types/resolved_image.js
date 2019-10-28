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

    static fromString(name: string): ResolvedImage {
        return new ResolvedImage({name, available: false});
    }

    serialize(): Array<mixed> {
        return ["image", this.name];
    }
}
