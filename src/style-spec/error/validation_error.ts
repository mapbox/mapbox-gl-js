// Note: Do not inherit from Error. It breaks when transpiling to ES5.

export default class ValidationError {
    message: string;
    identifier: string | null | undefined;
    line: number | null | undefined;

    constructor(key: string | null | undefined, value: {
        __line__: number;
    } | null | undefined, message: string, identifier?: string | null) {
        this.message = (key ? `${key}: ` : '') + message;
        if (identifier) this.identifier = identifier;

        if (value !== null && value !== undefined && value.__line__) {
            this.line = value.__line__;
        }
    }
}

export class ValidationWarning extends ValidationError {}
