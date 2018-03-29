
export default class ValidationError {
    constructor(key, value, message) {
        this.message = (key ? `${key}: ` : '') + message;

        if (value !== null && value !== undefined && value.__line__) {
            this.line = value.__line__;
        }
    }
}

export class ValidationWarning extends ValidationError {
    constructor(key, value, message) {
        super(key, value, message);
        this.type = 'warning';
    }
}
