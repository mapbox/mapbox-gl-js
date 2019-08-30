// @flow

export default class Image {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    toString(): string {
        return this.name;
    }

    static fromString(imageName: string): Image {
        return new Image(imageName);
    }

    serialize(): Array<mixed> {
        return ["image", this.name];
    }
}
