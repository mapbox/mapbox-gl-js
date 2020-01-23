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

    static fromString(name: string, availableImages?: ?Array<string>): ResolvedImage {
        const available = availableImages ? availableImages.indexOf(name) > -1 : false;
        return new ResolvedImage({name, available});
    }

    serialize(): Array<string> {
        return ["image", this.name];
    }
}
