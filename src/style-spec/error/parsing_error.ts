// Note: Do not inherit from Error. It breaks when transpiling to ES5.

const LINE_NUMBER_RE = /line (\d+)/;

export default class ParsingError {
    message: string;
    error: Error;
    line: number;

    constructor(error: Error) {
        this.error = error;
        this.message = error.message;
        const match = error.message.match(LINE_NUMBER_RE);
        this.line = match ? parseInt(match[1], 10) : 0;
    }
}
