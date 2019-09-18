// @flow

export default class ResolvedImage {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    toString(): string {
        return this.name;
    }

    static fromString(imageName: string): ResolvedImage {
        return new ResolvedImage(imageName);
    }

    serialize(): Array<mixed> {
        return ["image", this.name];
    }
}
