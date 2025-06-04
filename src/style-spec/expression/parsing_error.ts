class ParsingError extends Error {
    key: string;
    override message: string;
    constructor(key: string, message: string) {
        super(message);
        this.message = message;
        this.key = key;
    }
}

export default ParsingError;
