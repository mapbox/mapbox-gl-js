
module.exports = function upgrade(v0) {

    var v1 = {
        version: '1',
        layers: [],
        styles: {}
    };


    // parse buckets

    var bucketStyles = {};

    var bucketIndex = {
        background: ['background']
    };

    function jsonValue(value) {
        return typeof value === 'string' ? '\'' + value + '\'' : value;
    }

    for (var id in v0.buckets) {
        var v0bucket = v0.buckets[id];
        var bucket = [id];

        // parse filters

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
            } else {
                filters.push(valueFilters.join(' || '));
            }
        }
        if (v0bucket.feature_type) {
            filters.push('feature_type == ' + jsonValue(v0bucket.feature_type));
        }
        if (filters.length) {
            bucket.push(filters.join(' && '));
        }

        // parse styles

        var styles = {};

        function pointValue(p) {
            return [p.x, p.y];
        }

        if (v0bucket.enabled) styles['enabled'] = ["min", v0bucket.enabled];

        // line styles
        if (v0bucket.cap)        styles['line-cap'] = v0bucket.cap;
        if (v0bucket.join)       styles['line-join'] = v0bucket.join;
        if (v0bucket.roundLimit) styles['line-round-limit'] = v0bucket.roundLimit;

        // point styles
        if (v0bucket.spacing)    styles['point-spacing'] = v0bucket.spacing;
        if (v0bucket.size)       styles['point-size'] = pointValue(v0bucket.size);

        // text styles
        if (v0bucket.text_field) styles['text-field'] = v0bucket.text_field;
        if (v0bucket.font)       styles['text-font'] = v0bucket.font;
        if (v0bucket.fontSize)   styles['text-size'] = v0bucket.fontSize;
        if (v0bucket.path)       styles['text-path'] = v0bucket.path;
        if (v0bucket.padding)    styles['text-padding'] = v0bucket.padding;

        if (v0bucket.textMinDistance) styles['text-min-dist'] = v0bucket.textMinDistance;
        if (v0bucket.maxAngleDelta)   styles['text-max-angle'] = v0bucket.maxAngleDelta;
        if (v0bucket.alwaysVisible)   styles['text-always-visible'] = v0bucket.padding;

        if (Object.keys(styles).length) {
            bucketStyles[id] = styles;
        }

        bucketIndex[id] = bucket;
    }


    // parse structure

    var layerIndex = {};

    function parseStructure(structure) {
        var buckets = [];

        for (var i = 0; i < structure.length; i++) {

            var layerId = structure[i].name,
                bucketId = structure[i].bucket,
                bucket = [layerId];

            if (structure[i].layers) {
                bucket.push('', parseStructure(structure[i].layers));
            } else {
                layerIndex[layerId] = bucketId;
                bucket = bucket.concat(bucketIndex[bucketId].slice(1));
            }

            buckets.push(bucket);
        }

        return buckets;
    }

    v1.layers = parseStructure(v0.structure);


    // parse styles

    var typedRules = {
        color: 'color'
    }

    function convertRule(layerId, style, v0rule, v0value) {
        var typed = typedRules[v0rule],
            rule = typed ?
                (layerIndex[layerId] === 'background' ? 'fill' : v0.buckets[layerIndex[layerId]].type) + '-' + typed :
                v0rule;

        style[rule] = v0value;
    }

    for (var i = 0; i < v0.classes.length; i++) {
        var klass = v1.styles[v0.classes[i].name] = {};

        for (var layerId in v0.classes[i].layers) {
            var v0rules = v0.classes[i].layers[layerId];
            var style = klass[layerId] = {};

            for (var rule in v0rules) {
                convertRule(layerId, style, rule, v0rules[rule])
            }
        }
    }


    return v1;
};
