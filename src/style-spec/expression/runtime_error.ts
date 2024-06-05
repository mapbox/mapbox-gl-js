class RuntimeError {
    name: string;
    message: string;

    constructor(message: string) {
        this.name = 'ExpressionEvaluationError';
        this.message = message;
    }

    toJSON(): string {
        return this.message;
    }
}

export default RuntimeError;
