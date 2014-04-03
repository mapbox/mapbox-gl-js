
module.exports = function upgrade(v0) {

    var v1 = {};

    v1.version = '1';


    // parse buckets

    var bucketIndex = {
        background: ['background']
    };

    function jsonValue(value) {
        return typeof value === 'string' ? '\'' + value + '\'' : value;
    }

    for (var id in v0.buckets) {
        var v0bucket = v0.buckets[id];
        var bucket = [id];

        var filters = [];

        if (v0bucket.source) {
            filters.push('source == ' + jsonValue(v0bucket.source));
        }

        if (v0bucket.layer) {
            filters.push('layer == ' + jsonValue(v0bucket.layer));
        }
        if (v0bucket.value) {
            var valueFilters = (Array.isArray(v0bucket.value) ? v0bucket.value : [v0bucket.value]).map(function (value) {
                return v0bucket.field + ' == ' + jsonValue(value);
            });
            if (valueFilters.length > 1) {
                filters.push('(' + valueFilters.join(' || ') + ')');
            }else {
                filters.push(valueFilters.join(' || '));
            }
        }
        if (filters.length) {
            bucket.push(filters.join(' && '));
        }

        bucketIndex[id] = bucket;
    }


    // parse structure

    function parseStructure(structure) {
        var buckets = [];

        for (var i = 0; i < structure.length; i++) {

            var id = structure[i].name,
                bucketId = structure[i].bucket,
                bucket = [id];

            if (structure[i].layers) {
                bucket.push('', parseStructure(structure[i].layers));
            } else {
                bucket = bucket.concat(bucketIndex[bucketId].slice(1));
            }

            buckets.push(bucket);
        }

        return buckets;
    }

    v1.buckets = parseStructure(v0.structure);

    // v1.styles = v0.classes;

    return v1;
};
