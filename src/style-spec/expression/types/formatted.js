// @flow

export class FormattedSection {
    text: string;
    scale: number | null;
    fontStack: string | null;

    constructor(text: string, scale: number | null, fontStack: string | null) {
        this.text = text;
        this.scale = scale;
        this.fontStack = fontStack;
    }
}

export default class Formatted {
    sections: Array<FormattedSection>;

    constructor(sections: Array<FormattedSection>) {
        this.sections = sections;
    }

    static fromString(unformatted: string): Formatted {
        return new Formatted([new FormattedSection(unformatted, null, null)]);
    }

    toString(): string {
        return this.sections.map(section => section.text).join('');
    }

    serialize() {
        const serialized = ["format"];
        for (const section of this.sections) {
            serialized.push(section.text);
            const fontStack = section.fontStack ?
                ["literal", section.fontStack.split(',')] :
                null;
            serialized.push({ "text-font": fontStack, "font-scale": section.scale });
        }
        return serialized;
    }
}
