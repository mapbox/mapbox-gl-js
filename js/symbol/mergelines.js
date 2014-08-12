'use strict';

module.exports = function (features, textFeatures, geometries) {

    var leftIndex = {},
        rightIndex = {},
        mergedFeatures = [],
        mergedGeom = [],
        mergedTexts = [],
        mergedIndex = 0,
        k;

    function add(k) {
        mergedFeatures.push(features[k]);
        mergedGeom.push(geometries[k]);
        mergedTexts.push(textFeatures[k]);
        mergedIndex++;
    }

    function mergeFromRight(leftKey, rightKey, geom) {
        var i = rightIndex[leftKey];
        delete rightIndex[leftKey];
        rightIndex[rightKey] = i;

        mergedGeom[i][0].pop();
        mergedGeom[i][0] = mergedGeom[i][0].concat(geom[0]);
        return i;
    }

    function mergeFromLeft(leftKey, rightKey, geom) {
        var i = leftIndex[rightKey];
        delete leftIndex[rightKey];
        leftIndex[leftKey] = i;

        mergedGeom[i][0].shift();
        mergedGeom[i][0] = geom[0].concat(mergedGeom[i][0]);
        return i;
    }

    function getKey(text, geom, onRight) {
        var point = onRight ? geom[0][geom[0].length - 1] : geom[0][0];
        return text + ':' + point.x + ':' + point.y;
    }

    for (k = 0; k < features.length; k++) {
        var geom = geometries[k],
            text = textFeatures[k];

        if (!text) {
            add(k);
            continue;
        }

        var leftKey = getKey(text, geom),
            rightKey = getKey(text, geom, true);

        if ((leftKey in rightIndex) && (rightKey in leftIndex) && (rightIndex[leftKey] !== leftIndex[rightKey])) {
            // found lines with the same text adjacent to both ends of the current line, merge all three
            var j = mergeFromLeft(leftKey, rightKey, geom);
            var i = mergeFromRight(leftKey, rightKey, mergedGeom[j]);

            delete leftIndex[leftKey];
            delete rightIndex[rightKey];

            rightIndex[getKey(text, mergedGeom[i], true)] = i;
            mergedGeom[j] = null;

        } else if (leftKey in rightIndex) {
            // found mergeable line adjacent to the start of the current line, merge
            mergeFromRight(leftKey, rightKey, geom);

        } else if (rightKey in leftIndex) {
            // found mergeable line adjacent to the end of the current line, merge
            mergeFromLeft(leftKey, rightKey, geom);

        } else {
            // no adjacent lines, add as a new item
            add(k);
            leftIndex[leftKey] = mergedIndex - 1;
            rightIndex[rightKey] = mergedIndex - 1;
        }
    }

    return {
        features: mergedFeatures,
        textFeatures: mergedTexts,
        geometries: mergedGeom
    };
};
