
export default class ValidationError {
    identifier?: string;
    message: string;
    line?: number;

    constructor(key: string, value: any, message: string, identifier?: string) {
        this.message = (key ? `${key}: ` : '') + message;
        if (identifier) this.identifier = identifier;

        if (value !== null && value !== undefined && value.__line__) {
            this.line = value.__line__;
        }
    }
}
