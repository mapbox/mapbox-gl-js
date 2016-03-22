'use strict';

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
    return this._stringToNumber[string];
};

DictionaryCoder.prototype.decode = function(n) {
    return this._numberToString[n];
};
