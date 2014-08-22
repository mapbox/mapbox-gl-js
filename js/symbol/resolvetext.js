'use strict';

var resolveTokens = require('../util/token.js');

module.exports = resolveText;

// For an array of features determine what glyph ranges need to be loaded
// and apply any text preprocessing. The remaining users of text should
// use the `textFeatures` key returned by this function rather than accessing
// feature text directly.
function resolveText(features, info, glyphs) {
    var textFeatures = [];
    var codepoints = [];

    for (var i = 0, fl = features.length; i < fl; i++) {
        var text = resolveTokens(features[i].properties, info['text-field']);
        var hastext = false;
        if (!text) continue;
        text = text.toString();

        var transform = info['text-transform'];
        if (transform === 'uppercase') {
            text = text.toLocaleUpperCase();
        } else if (transform === 'lowercase') {
            text = text.toLocaleLowerCase();
        }

        if (isRTL(text)) {
          var textWords = text.split(' ');
          var ltrText = '';
          var rtlBuffer = '';
          for (var t = 0; t < textWords.length; t++) {
            if (isRTL(textWords[t])) {
              var rtlWord = textWords[t].split('').reverse().join('');
              rtlBuffer = rtlWord + ' ' + rtlBuffer;
            }
            else {
              ltrText += rtlBuffer + ' ' + textWords[t];
              rtlBuffer = '';
            }
          }
          if (ltrText.length && rtlBuffer.length) {
            ltrText += ' ';
          }
          ltrText += rtlBuffer;
          text = ltrText;
        }

        for (var j = 0, jl = text.length; j < jl; j++) {
            if (text.charCodeAt(j) <= 65533) {
                codepoints.push(text.charCodeAt(j));
                hastext = true;
            }
        }
        // Track indexes of features with text.
        if (hastext) {
            textFeatures[i] = text;
        }
    }

    // get a list of unique codepoints we are missing
    codepoints = uniq(codepoints, glyphs);

    return {
        textFeatures: textFeatures,
        codepoints: codepoints
    };
}

function isRTL(s) {
  var rtlChars = '\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC',
  rtlDirCheck = new RegExp('^[^'+rtlChars+']*?['+rtlChars+']');
  return rtlDirCheck.test(s);
}

function uniq(ids, alreadyHave) {
    var u = [];
    var last;
    ids.sort(sortNumbers);
    for (var i = 0; i < ids.length; i++) {
        if (ids[i] !== last) {
            last = ids[i];
            if (!alreadyHave[last]) u.push(ids[i]);
        }
    }
    return u;
}

function sortNumbers(a, b) {
    return a - b;
}
