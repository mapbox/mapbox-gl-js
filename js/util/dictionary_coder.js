'use strict';

var assert = require('assert');

module.exports = DictionaryCoder;

function DictionaryCoder(strings) {
    this._stringToNumber = {};
    this._numberToString = [];
    for (var i = 0; i < strings.length; i++) {
        var string = strings[i];
        this._stringToNumber[string] = i;
        this._numberToString[i] = string;
    }
}

DictionaryCoder.prototype.encode = function(string) {
    assert(string in this._stringToNumber);
    return this._stringToNumber[string];
};

DictionaryCoder.prototype.decode = function(n) {
    assert(n < this._numberToString.length);
    return this._numberToString[n];
};
