import ParsingError from './error/parsing_error';

import type {StyleSpecification} from './types';

export default function readStyle(style: string | Buffer | StyleSpecification): StyleSpecification {
    if (style instanceof String || typeof style === 'string' || ArrayBuffer.isView(style)) {
        try {
            const str = style.toString();
            JSON.parse(str); // first try full parsing to catch malformed JSON
            return parse(str) as StyleSpecification; // then our custom parser
        } catch (e) {
            throw new ParsingError(e as Error);
        }
    }

    return style;
}

// custom JSON parser that assumes valid JSON and wraps values to include line metadata

export const LBRACE   = 0; // {
export const RBRACE   = 1; // }
export const LBRACKET = 2; // [
export const RBRACKET = 3; // ]
export const STRING   = 4; // "..."
export const NUMBER   = 5; // -1.5e+3
export const TRUE     = 6; // true
export const FALSE    = 7; // false
export const NULL     = 8; // null

export function tokenize(s: string) {
    const tokens: number[] = [];
    let pos = 0;
    const len = s.length;

    while (pos < len) {
        const c = s.charCodeAt(pos);

        if (c === 32 || c === 9 || c === 10 || c === 13 || c === 58 || c === 44) { // whitespace
            pos++;
            continue;
        }

        const start = pos;

        if (c === 123) tokens.push(LBRACE, start, ++pos); // {
        else if (c === 125) tokens.push(RBRACE,   start, ++pos); // }
        else if (c === 91) tokens.push(LBRACKET, start, ++pos); // [
        else if (c === 93) tokens.push(RBRACKET, start, ++pos); // ]
        else if (c === 34) { // "
            pos++;
            while (pos < len) {
                const ch = s.charCodeAt(pos);
                if (ch === 92) pos += s.charCodeAt(pos + 1) === 117 ? 6 : 2; // escape; \uXXXX = 6 chars, others = 2
                else if (ch === 34) break; // closing quote
                else pos++;
            }
            tokens.push(STRING, start, ++pos);
        } else if (c === 116) tokens.push(TRUE,  start, pos += 4); // true
        else if (c === 102) tokens.push(FALSE, start, pos += 5); // false
        else if (c === 110) tokens.push(NULL,  start, pos += 4); // null
        else { // number
            while (pos < len) {
                const ch = s.charCodeAt(pos);
                if ((ch >= 48 && ch <= 57) || ch === 45 || ch === 43 || ch === 46 || ch === 101 || ch === 69) pos++;
                else break;
            }
            tokens.push(NUMBER, start, pos);
        }
    }

    return tokens;
}

/* eslint-disable @typescript-eslint/no-wrapper-object-types */
type JSONValue = String | Number | Boolean | null | {[key: string]: JSONValue} | JSONValue[];

function parseTokens(s: string, tokens: number[]) {
    let i = 0;

    const lineOffsets = [0];
    for (let j = 0; j < s.length; j++) {
        if (s.charCodeAt(j) === 10) lineOffsets.push(j + 1);
    }

    function lineNum(pos: number) {
        let lo = 0, hi = lineOffsets.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (lineOffsets[mid] <= pos) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    }

    function setLine<T>(obj: T, line: number): T {
        Object.defineProperty(obj, '__line__', {value: line});
        return obj;
    }

    function parseValue(): JSONValue {
        const type = tokens[i];
        const start = tokens[i + 1];
        const end = tokens[i + 2];
        i += 3;

        const line = lineNum(start);

        if (type === LBRACE) {
            const obj = setLine({}, line);
            while (tokens[i] !== RBRACE) {
                const key: string = JSON.parse(s.slice(tokens[i + 1], tokens[i + 2])) as string;
                i += 3;
                obj[key] = parseValue();
            }
            i += 3;
            return obj;
        }
        if (type === LBRACKET) {
            const arr: JSONValue = setLine([], line);
            while (tokens[i] !== RBRACKET) arr.push(parseValue());
            i += 3;
            return arr;
        }
        /* eslint-disable no-new-wrappers */
        if (type === STRING) return setLine(new String(JSON.parse(s.slice(start, end))), line);
        if (type === NUMBER) return setLine(new Number(+s.slice(start, end)), line);
        if (type === TRUE)   return setLine(new Boolean(true), line);
        if (type === FALSE)  return setLine(new Boolean(false), line);
        return null; // null cannot carry properties
    }

    return parseValue();
}

function parse(s: string): JSONValue {
    return parseTokens(s, tokenize(s));
}
