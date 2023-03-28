// @flow

export type ResolvedImageOptions = {
    namePrimary: string,
    nameSecondary: ?string,
    available: boolean
};

export default class ResolvedImage {
    namePrimary: string;
    nameSecondary: ?string;
    available: boolean;

    constructor(options: ResolvedImageOptions) {
        this.namePrimary = options.namePrimary;
        if (options.nameSecondary) {
            this.nameSecondary = options.nameSecondary;
        }
        this.available = options.available;
    }

    toString(): string {
        if (this.nameSecondary) {
            return `[${this.namePrimary},${this.nameSecondary}]`;
        }
        return this.namePrimary;
    }

    static fromString(namePrimary: string, nameSecondary: ?string): ResolvedImage | null {
        if (!namePrimary) return null; // treat empty values as no image
        return new ResolvedImage({namePrimary, nameSecondary, available: false});
    }

    serialize(): Array<string> {
        if (this.nameSecondary) {
            return ["image", this.namePrimary, this.nameSecondary];
        }
        return ["image", this.namePrimary];
    }
}
