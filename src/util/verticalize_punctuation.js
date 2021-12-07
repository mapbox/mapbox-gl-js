// @flow

import {charHasRotatedVerticalOrientation} from './script_detection.js';

export const verticalizedCharacterMap = (() => {
    const pairs = '!︕#＃$＄%％&＆(︵)︶*＊+＋,︐-︲.・/／:︓;︔<︿=＝>﹀?︖@＠[﹇\\＼]﹈^＾_︳`｀{︷|―}︸~～¢￠£￡¥￥¦￤¬￢¯￣–︲—︱‘﹃’﹄“﹁”﹂…︙‧・₩￦、︑。︒〈︿〉﹀《︽》︾「﹁」﹂『﹃』﹄【︻】︼〔︹〕︺〖︗〗︘！︕（︵）︶，︐－︲．・：︓；︔＜︿＞﹀？︖［﹇］﹈＿︳｛︷｜―｝︸｟︵｠︶｡︒｢﹁｣﹂''!︕#＃$＄%％&＆(︵)︶*＊+＋,︐-︲.・/／:︓;︔<︿=＝>﹀?︖@＠[﹇\\＼]﹈^＾_︳`｀{︷|―}︸~～¢￠£￡¥￥¦￤¬￢¯￣–︲—︱‘﹃’﹄“﹁”﹂…︙‧・₩￦、︑。︒〈︿〉﹀《︽》︾「﹁」﹂『﹃』﹄【︻】︼〔︹〕︺〖︗〗︘！︕（︵）︶，︐－︲．・：︓；︔＜︿＞﹀？︖［﹇］﹈＿︳｛︷｜―｝︸｟︵｠︶｡︒｢﹁｣﹂';
    const map = {};
    for (let i = 0; i < pairs.length; i += 2) map[pairs[i]] = pairs[i + 1];
    return map;
})();

export default function verticalizePunctuation(input: string, skipContextChecking: boolean) {
    let output = '';

    for (let i = 0; i < input.length; i++) {
        const nextCharCode = input.charCodeAt(i + 1) || null;
        const prevCharCode = input.charCodeAt(i - 1) || null;

        const canReplacePunctuation = skipContextChecking || (
            (!nextCharCode || !charHasRotatedVerticalOrientation(nextCharCode) || verticalizedCharacterMap[input[i + 1]]) &&
            (!prevCharCode || !charHasRotatedVerticalOrientation(prevCharCode) || verticalizedCharacterMap[input[i - 1]])
        );

        if (canReplacePunctuation && verticalizedCharacterMap[input[i]]) {
            output += verticalizedCharacterMap[input[i]];
        } else {
            output += input[i];
        }
    }

    return output;
}

export function isVerticalClosePunctuation(chr: string) {
    return '︶﹈︸﹄﹂︾︼︺︘﹀︐︓︔｀￣︑︒'.includes(chr);
}

export function isVerticalOpenPunctuation(chr: string) {
    return '︵﹇︷﹃﹁︽︻︹︗︿'.includes(chr);
}
