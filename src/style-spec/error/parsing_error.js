
export default class ParsingError {
    error: Error;
    message: string;
    line: number;

    constructor(error: Error) {
        this.error = error;
        this.message = error.message;
        const match = error.message.match(/line (\d+)/);
        this.line = match ? parseInt(match[1], 10) : 0;
    }
}
