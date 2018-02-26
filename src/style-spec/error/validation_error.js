
function ValidationError(key, value, message) {
    this.message = (key ? `${key}: ` : '') + message;

    if (value !== null && value !== undefined && value.__line__) {
        this.line = value.__line__;
    }
}

export default ValidationError;
