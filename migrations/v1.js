
'use strict';

module.exports = function upgrade(v0) {

    var v1 = {
        version: '1',
        layers: [],
        constants: {},
        styles: {},
        sprite: v0.sprite
    };


    // parse buckets

    var bucketStyles = {};

    var bucketIndex = {
        background: {id: 'background'}
    };

    function pointValue(p) {
        return typeof p === 'number' ? [p, p] : [p.x, p.y];
    }

    function convertExpression(filter, expression) {
        var op = 'and';
        var operands = [];
        for (var i = 0; i < expression.length; i++) {
            if (typeof expression[i] === 'string') {
                if (expression[i] == 'and' || expression[i] == 'or') {
                    op = expression[i];
                }
            } else {
                operands.push(expression[i]);
            }
        }

        if (op == 'or') {
            filter['||'] = {};
            filter = filter['||'];
        }

        for (var i = 0; i < operands.length; i++) {
            if (!operands[i].operator) {
                filter[operands[i].field] = operands[i].value;
            } else {
                if (!filter[operands[i].field]) {
                    filter[operands[i].field] = {};
                }
                filter[operands[i].field][operands[i].operator] = operands[i].value;
            }
        }
    }

    function setBucketRule(rule, v0bucket, bucketId, filter, styles) {

        switch (rule) {
            case 'type': break;

            case 'source':       filter.source = v0bucket.source; break;
            case 'layer':        filter.layer = v0bucket.layer; break;
            case 'field':        break;
            case 'value':        filter[v0bucket.field] = v0bucket.value; break;
            case 'feature_type': filter.feature_type = v0bucket.feature_type; break;

            case 'enabled': styles['min-zoom'] = v0bucket.enabled; break;

            // line styles
            case 'cap':        styles['line-cap'] = v0bucket.cap; break;
            case 'join':       styles['line-join'] = v0bucket.join; break;
            case 'roundLimit': styles['line-round-limit'] = v0bucket.roundLimit; break;

            // point styles
            case 'spacing': styles['point-spacing'] = v0bucket.spacing; break;
            case 'size':    styles['point-size'] = pointValue(v0bucket.size); break;
            case 'icon':    styles['point-image'] = v0bucket.icon; break;

            // text styles
            case 'text_field': styles['text-field'] = v0bucket.text_field; break;
            case 'font':       styles['text-font'] = v0bucket.font; break;
            case 'fontSize':   styles['text-max-size'] = v0bucket.fontSize; break;
            case 'path':       styles['text-path'] = v0bucket.path; break;
            case 'padding':    styles['text-padding'] = v0bucket.padding; break;

            case 'maxWidth':          styles['text-max-width'] = v0bucket.maxWidth; break;
            case 'letterSpacing':     styles['text-letter-spacing'] = v0bucket.letterSpacing; break;
            case 'lineHeight':        styles['text-line-height'] = v0bucket.lineHeight; break;
            case 'verticalAlignment': styles['text-alignment'] = v0bucket.verticalAlignment; break;
            case 'slant':             styles['text-slant'] = v0bucket.slant; break;
            case 'translate':         styles['text-translate'] = v0bucket.translate; break;

            case 'textMinDistance': styles['text-min-dist'] = v0bucket.textMinDistance; break;
            case 'maxAngleDelta':   styles['text-max-angle'] = v0bucket.maxAngleDelta; break;
            case 'alwaysVisible':   styles['text-always-visible'] = v0bucket.alwaysVisible; break;

            case 'filter': convertExpression(filter, v0bucket.filter); break;

            default: console.warn('removed deprecated or unused bucket style rule: ' + rule + ' (' + bucketId + ')');
        }
    }

    for (var id in v0.buckets) {
        var v0bucket = v0.buckets[id];
        var bucket = {id: id};

        // parse filters

        var filter = {},
            styles = {};

        for (var rule in v0bucket) {
            setBucketRule(rule, v0bucket, id, filter, styles);
        }

        if (v0bucket.source) filter.source = v0bucket.source;
        if (v0bucket.layer) filter.layer = v0bucket.layer;
        if (v0bucket.value) filter[v0bucket.field] = v0bucket.value;
        if (v0bucket.feature_type) filter.feature_type = v0bucket.feature_type;

        if (Object.keys(filter).length) bucket.filter = filter;
        if (Object.keys(styles).length) bucketStyles[id] = styles;

        bucketIndex[id] = bucket;
    }


    // parse structure

    var layerIndex = {};

    function parseStructure(structure) {
        var buckets = [];

        for (var i = 0; i < structure.length; i++) {

            var layerId = structure[i].name,
                bucketId = structure[i].bucket,
                bucket = {id: layerId};

            if (structure[i].layers) {
                bucket.layers = parseStructure(structure[i].layers);
            } else {
                layerIndex[layerId] = bucketId;
                bucket.filter = bucketIndex[bucketId].filter;
            }

            buckets.push(bucket);
        }

        return buckets;
    }

    v1.layers = parseStructure(v0.structure);


    // parse styles

    var typedRules = {
        color: 'color',
        width: 'width',
        opacity: 'opacity',
        image: 'image',
        translate: 'translate',
        dasharray: 'dasharray',
        antialias: 'antialias',
        alignment: 'alignment',
        radius: 'radius',
        blur: 'blur',
        size: 'size',
        brightness_low: 'brightness-low',
        brightness_high: 'brightness-high',
        saturation: 'saturation',
        spin: 'spin',
        contrast: 'contrast',
        offset: 'offset',
        rotate: 'rotate',
        miterLimit: 'miter-limit',
        invert: 'invert'
    };

    var otherRules = {
        stroke: 'line-color',
        strokeWidth: 'line-width',
        enabled: 'min-zoom',
        opacity: 'opacity'
    };

    function convertValue(v0value, v0rule) {
        if (Array.isArray(v0value)) {
            if (v0value[0] === 'linear' || v0value[0] === 'exponential') {
                var value = {
                    fn: v0value[0],
                    z: v0value[1],
                    val: v0value[2],
                    slope: v0value[3],
                    min: v0value[4]
                };
                if (v0value[5]) {
                    value.max = v0value[5];
                }
                return value;
            }
            if (v0value[0] === 'stops') {
                return {
                    fn: 'stops',
                    stops: v0value.slice(1).map(function (v) {
                        return [v.z, v.val];
                    }, {})
                };
            }
            if (v0value[0] === 'min') {
                if (v0rule === 'enabled') return v0value[1];
                return {
                    fn: 'min',
                    val: v0value[1]
                };
            }
        }

        return v0value;
    }

    function convertRule(layerId, style, v0rule, v0value) {
        var transition = v0rule.indexOf('transition-') === 0;

        v0rule = v0rule.replace('transition-', '');

        var typed = typedRules[v0rule],
            v0bucket = v0.buckets[layerIndex[layerId]];

        var rule =
            typed && v0bucket && v0bucket.type ? v0bucket.type + '-' + typed :
            typed && layerIndex[layerId] === 'background' ? 'fill-' + typed :
            otherRules[v0rule];

        if (v0bucket && v0bucket.type === 'text') {
            if (v0rule === 'strokeWidth') rule = 'text-halo-width';
            if (v0rule === 'stroke') rule = 'text-halo-color';
            if (v0rule === 'strokeBlur') rule = 'text-halo-blur';
        }

        if (v0bucket && v0bucket.type) {
            switch (v0rule) {
                case 'prerender':
                case 'prerender-size':
                case 'prerender-blur':
                case 'prerender-buffer':
                    rule = v0bucket.type + '-' + v0rule;
                    break;
            }
        }

        if (!rule) {
            console.warn('removed deprecated or unused style rule: ' + v0rule + ' (' + layerId + ')');
        } else {
            style[transition ? 'transition-' + rule : rule] = convertValue(v0value, v0rule);
        }
    }

    for (var constant in v0.constants) {
        v1.constants[constant] = convertValue(v0.constants[constant]);
    }

    for (var i = 0; i < v0.classes.length; i++) {
        var klass = v1.styles[v0.classes[i].name] = {};

        for (var layerId in v0.classes[i].layers) {
            var v0rules = v0.classes[i].layers[layerId];
            var style = klass[layerId] = {};

            for (var v0rule in v0rules) {
                convertRule(layerId, style, v0rule, v0rules[v0rule]);
            }

            if (bucketStyles[layerIndex[layerId]]) {
                var bucketStyle = bucketStyles[layerIndex[layerId]];
                for (var bucketRule in bucketStyle) {
                    style[bucketRule] = bucketStyle[bucketRule];
                }
            }
        }
    }

    return v1;
};
