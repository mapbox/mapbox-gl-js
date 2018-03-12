import through from 'through2';
import path from 'path';

export default (file) => {
    if (path.extname(file) === '.json') {
        return through();
    }
    let first = true;
    return through(function (chunk, encoding, callback) {
        if (first) {
            this.push("'use strict';");
            first = false;
        }
        this.push(chunk);
        callback();
    });
};
