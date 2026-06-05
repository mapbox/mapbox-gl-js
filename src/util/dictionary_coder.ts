import assert from '../style-spec/util/assert';

class DictionaryCoder {
    _stringToNumber: {
        [_: string]: number;
    };
    _numberToString: Array<string>;

    constructor(strings: Array<string>) {
        this._stringToNumber = {};
        this._numberToString = [];
        for (let i = 0; i < strings.length; i++) {
            const string = strings[i] as string;
            this._stringToNumber[string] = i;
            this._numberToString[i] = string;
        }
    }

    encode(string: string): number {
        assert(string in this._stringToNumber);
        return this._stringToNumber[string] as number;
    }

    decode(n: number): string {
        assert(n < this._numberToString.length);
        return this._numberToString[n] as string;
    }
}

export default DictionaryCoder;
