'use strict';

module.exports = function (features, textFeatures, geometries) {
    var startIndex = {},
        endIndex = {},
        mergedFeatures = [],
        mergedGeometries = [],
        mergedTexts = [],
        mergedIndex = 0,
        k;

    for (k = 0; k < features.length; k++) {
        var geom = geometries[k],
            text = textFeatures[k];

        if (!text) {
            mergedFeatures.push(features[k]);
            mergedGeometries.push(geom);
            mergedTexts.push(text);
            mergedIndex++;
            continue;
        }

        var last = geom[0].length - 1,
            startKey = text + ':' + geom[0][0].x + ':' + geom[0][0].y,
            endKey = text + ':' + geom[0][last].x + ':' + geom[0][last].y,
            i, j;

        if ((startKey in endIndex) && (endKey in startIndex) && (endIndex[startKey] !== startIndex[endKey])) {
            // found lines with the same text adjacent to both ends of the current line
            i = endIndex[startKey];
            j = startIndex[endKey];

            mergedGeometries[i][0].pop();
            mergedGeometries[j][0].shift();
            mergedGeometries[i][0] = mergedGeometries[i][0].concat(geom[0]).concat(mergedGeometries[j][0]);

            delete endIndex[startKey];
            delete startIndex[endKey];

            var last2 = mergedGeometries[j][0][mergedGeometries[j][0].length - 1];
            endIndex[text + ':' + last2.x + ':' + last2.y] = i;

            mergedGeometries[j] = null;

        } else if (startKey in endIndex) {
            // found line with the same text adjacent to the start of the current line
            i = endIndex[startKey];
            mergedGeometries[i][0].pop();
            mergedGeometries[i][0] = mergedGeometries[i][0].concat(geom[0]);

            delete endIndex[startKey];
            endIndex[endKey] = i;

        } else if (endKey in startIndex) {
            // found line with the same text adjacent to the end of the current line
            i = startIndex[endKey];
            mergedGeometries[i][0].shift();
            mergedGeometries[i][0] = geom[0].concat(mergedGeometries[i][0]);

            delete startIndex[endKey];
            startIndex[startKey] = i;

        } else {
            mergedFeatures.push(features[k]);
            mergedGeometries.push(geom);
            mergedTexts.push(text);

            startIndex[startKey] = mergedIndex;
            endIndex[endKey] = mergedIndex;
            mergedIndex++;
        }
    }

    return {
        features: mergedFeatures,
        textFeatures: mergedTexts,
        geometries: mergedGeometries
    };
};
