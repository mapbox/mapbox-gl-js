// Note: Do not inherit from Error. It breaks when transpiling to ES5.

export default class ValidationError {
    message: string;
    identifier: string | null | undefined;
    line: number | null | undefined;

    constructor(key: string | null | undefined, value: unknown, message: string, identifier?: string | null) {
        this.message = (key ? `${key}: ` : '') + message;
        if (identifier) this.identifier = identifier;

        if (value !== null && value !== undefined && (value as {__line__?: number}).__line__) {
            this.line = (value as {__line__?: number}).__line__;
        }
    }
}

export class ValidationWarning extends ValidationError {}
