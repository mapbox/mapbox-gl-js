'use strict';

const assert = require('assert');

class DictionaryCoder {

    constructor(strings) {
        this._stringToNumber = {};
        this._numberToString = [];
        for (let i = 0; i < strings.length; i++) {
            const string = strings[i];
            this._stringToNumber[string] = i;
            this._numberToString[i] = string;
        }
    }

    encode(string) {
        assert(string in this._stringToNumber);
        return this._stringToNumber[string];
    }

    decode(n) {
        assert(n < this._numberToString.length);
        return this._numberToString[n];
    }
}

module.exports = DictionaryCoder;
