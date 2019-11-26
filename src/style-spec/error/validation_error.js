// @flow

export default class ValidationError extends Error {
    identifier: ?string;
    line: ?number;

    constructor(key: string | null, value?: any, message?: string, identifier?: string) {
        super([key, message].filter(a => a).join(': '));
        if (identifier) this.identifier = identifier;

        if (value !== null && value !== undefined && value.__line__) {
            this.line = value.__line__;
        }
    }
}
