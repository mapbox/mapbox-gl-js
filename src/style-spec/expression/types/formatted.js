// @flow

import type Color from '../../util/color';

export class FormattedSection {
    text: string;
    scale: number | null;
    fontStack: string | null;
    textColor: Color | null;

    constructor(text: string, scale: number | null, fontStack: string | null, textColor: Color | null) {
        this.text = text;
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
        return new Formatted([new FormattedSection(unformatted, null, null, null)]);
    }

    toString(): string {
        return this.sections.map(section => section.text).join('');
    }

    serialize(): Array<mixed> {
        const serialized = ["format"];
        for (const section of this.sections) {
            serialized.push(section.text);
            const options = {};
            if (section.fontStack) {
                options["text-font"] = ["literal", section.fontStack.split(',')];
            }
            if (section.scale) {
                options["font-scale"] = section.scale;
            }
            if (section.textColor) {
                options["text-color"] = ["rgba"].concat(section.textColor.toArray());
            }
            serialized.push(options);
        }
        return serialized;
    }
}
