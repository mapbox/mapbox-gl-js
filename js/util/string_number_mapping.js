'use strict';

module.exports = StringNumberMapping;

function StringNumberMapping(strings) {
    this.stringToNumber = {};
    this.numberToString = [];
    for (var i = 0; i < strings.length; i++) {
        var string = strings[i];
        this.stringToNumber[string] = i;
        this.numberToString[i] = string;
    }
}
