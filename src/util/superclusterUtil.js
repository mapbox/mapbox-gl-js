// @flow

// Aggregate by and groupBy explained:
// Example:
//    options: {
//      aggregateBy: ['casualities', 'wounded'],
//      groupBy: 'incidentType'
//    },
//
//    features: [
//      {properties: {casualities: 10, wounded: 5, incidentType: 'accident'}, geometry: {...}, type: 'Point'},
//      {properties: {casualities: 50, wounded: 15, incidentType: 'explosion'}, geometry: {...}, type: 'Point'},
//      {properties: {casualities: 5, wounded: 5, incidentType: 'explosion'}, geometry: {...}, type: 'Point'},
//      {properties: {casualities: 0, wounded: 1, incidentType: 'explosion'}, geometry: {...}, type: 'Point'}
//    ]
//
// If all the above features are clusterd into a cluster, then the cluster will be as follows:
//    {
//      properties: {
//        casualities: 65,
//        wounded: 26,
//        casualities_group: {
//          accident: 10,
//          explosion: 55
//        }, wounded_group: {
//          accident: 5,
//          explosion: 21
//        }
//      }
//    }
exports.getMapReduceParams = function(options) {
    const aggregateByKeys = sanitizedAggregateByKeys(options);
    const groupBy = options.groupBy;

    return {
        initial: function () {
            const initial = {};
            aggregateByKeys.forEach((aggregateBy) => {
                initial[aggregateBy] = 0;
                initial[`${aggregateBy}_abbrev`] = '0';
                if (groupBy) {
                    initial[`${aggregateBy}_group`] = {};
                }
            });
            return initial;
        },
        map: function(props) {
            const mapped = {};
            aggregateByKeys.forEach((aggregateBy) => {
                const value = Number(props[aggregateBy]) || 0;

                mapped[aggregateBy] = value;
                mapped[`${aggregateBy}_abbrev`] = abbreviate(value);
                if (groupBy) {
                    mapped[`${aggregateBy}_group`] = {};
                    mapped[`${aggregateBy}_group`][props[groupBy]] = value;
                }
            });
            return mapped;
        },
        reduce: function (accumulated, props) {
            aggregateByKeys.forEach((aggregateBy) => {
                const value = Number(props[aggregateBy]) || 0;
                const aggregate = accumulated[aggregateBy] + value;

                accumulated[aggregateBy] = aggregate;
                accumulated[`${aggregateBy}_abbrev`] = abbreviate(aggregate);

                if (groupBy) {
                    const aggregateGroup = `${aggregateBy}_group`;
                    for (const category in props[aggregateGroup]) {
                        accumulated[aggregateGroup][category] =
                            (Number(accumulated[aggregateGroup][category]) || 0) +
                            (Number(props[aggregateGroup][category]) || 0);
                    }
                }
            });
            return accumulated;
        }
    };
};

function sanitizedAggregateByKeys(options) {
    let aggregateByKeys = [];
    if (options.aggregateBy) {
        aggregateByKeys = Array.isArray(options.aggregateBy) ? options.aggregateBy : [options.aggregateBy];
    }
    return aggregateByKeys;
}

const MILLION = 1000000;
const HUNDRED_K = 100000;
function abbreviate(value) {
    return value >= 10 * MILLION ? `${Math.round(value / MILLION)}m` :
    value >= MILLION ? `${Math.round(value / HUNDRED_K) / 10}m` :
    value >= 10000 ? `${Math.round(value / 1000)}k` :
    value >= 1000 ? `${Math.round(value / 100) / 10}k` : `${value}`;
}

exports.sanitizedAggregateByKeys = sanitizedAggregateByKeys;
exports.abbreviate = abbreviate;
