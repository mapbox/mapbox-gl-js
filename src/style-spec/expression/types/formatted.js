// @flow
import type Color from '../../util/color.js';
import type ResolvedImage from '../types/resolved_image.js';

export class FormattedSection {
    text: string;
    image: ResolvedImage | null;
    scale: number | null;
    fontStack: string | null;
    textColor: Color | null;

    constructor(text: string, image: ResolvedImage | null, scale: number | null, fontStack: string | null, textColor: Color | null) {
        this.text = text;
        this.image = image;
        this.scale = scale;
        this.fontStack = fontStack;
        this.textColor = textColor;
    }
}

export default class Formatted {
    sections: Array<FormattedSection>;

    constructor(sections: Array<FormattedSection>) {
        this.sections = sections;
    }

    static fromString(unformatted: string): Formatted {
        return new Formatted([new FormattedSection(unformatted, null, null, null, null)]);
    }

    isEmpty(): boolean {
        if (this.sections.length === 0) return true;
        return !this.sections.some(section => section.text.length !== 0 ||
                                             (section.image && section.image.name.length !== 0));
    }

    static factory(text: Formatted | string): Formatted {
        if (text instanceof Formatted) {
            return text;
        } else {
            return Formatted.fromString(text);
        }
    }

    toString(): string {
        if (this.sections.length === 0) return '';
        return this.sections.map(section => section.text).join('');
    }

    serialize(): Array<mixed> {
        const serialized: Array<mixed> = ["format"];
        for (const section of this.sections) {
            if (section.image) {
                serialized.push(["image", section.image.name]);
                continue;
            }
            serialized.push(section.text);
            const options: { [key: string]: mixed } = {};
            if (section.fontStack) {
                options["text-font"] = ["literal", section.fontStack.split(',')];
            }
            if (section.scale) {
                options["font-scale"] = section.scale;
            }
            if (section.textColor) {
                options["text-color"] = (["rgba"]: Array<mixed>).concat(section.textColor.toArray());
            }
            serialized.push(options);
        }
        return serialized;
    }
}
