// @flow

export default class Image {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    static fromString(imageName: string): Image {
        return new Image(imageName);
    }

    serialize(): Array<mixed> {
        return ["image", this.name];
    }
}
