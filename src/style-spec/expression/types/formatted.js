// @flow

import type { Value } from '../values';

export class FormattedSection {
    text: string;
    scale: number | null;
    fontStack: string | null;
    id: Value;

    constructor(text: string, scale: number | null, fontStack: string | null, id: Value) {
        this.text = text;
        this.scale = scale;
        this.fontStack = fontStack;
        this.id = id;
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

    hasMultipleUniqueSections(): boolean {
        if (this.sections.length < 2) {
            return false;
        }

        const section = this.sections[0].id;
        for (let i = 1; i < this.sections.length; ++i) {
            if (section !== this.sections[i].id) {
                return true;
            }
        }

        return false;
    }

    serialize() {
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
            if (section.id) {
                options["section"] = section.id;
            }
            serialized.push(options);
        }
        return serialized;
    }
}
