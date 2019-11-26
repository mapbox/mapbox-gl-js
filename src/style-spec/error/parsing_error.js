// @flow

export default class ParsingError extends Error {
    error: Error;
    line: number;

    constructor(error: Error) {
        super(error.message);
        this.error = error;
        const match = error.message.match(/line (\d+)/);
        this.line = match ? parseInt(match[1], 10) : 0;
    }
}
