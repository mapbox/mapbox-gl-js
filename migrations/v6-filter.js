'use strict';

function migrate(key, value) {
    switch (key) {
        case '!':
            return invert(module.exports(value));
        case '&':
            return module.exports(value);
        case '|':
            var f = module.exports(value);
            if (f[0] === 'all') {
                f[0] = 'any';
                return f;
            } else {
                return ['any', module.exports(value)];
            }
        case '^':
            throw new Error('can\'t migrate ^ (XOR) filters');
        default:
            if (typeof value !== 'object') {
                return ['==', key, value];
            } else if (Object.keys(value).length > 1) {
                throw new Error('can\'t migrate complex filter ' + JSON.stringify(value));
            } else {
                var k = Object.keys(value)[0],
                    v = value[k];
                if (k === 'in' || k === '!in') {
                    return [k, key].concat(v);
                } else {
                    return [k, key, v];
                }
            }
    }
}

function invert(filter6) {
    if (filter6[0] === 'all') {
        return ['any'].concat(filter6.slice(1).map(invert));
    } else {
        filter6[0] = {
            '==': '!=',
            '!=': '==',
            '<': '>=',
            '<=': '>',
            '>': '<=',
            '>=': '<',
            'in': '!in',
            '!in': 'in',
            'any': 'none',
            'none': 'any'
        }[filter6[0]];
        return filter6;
    }
}

module.exports = function(filter5) {
    var filters6 = [];

    for (var key in filter5) {
        filters6.push(migrate(key, filter5[key]));
    }

    if (filters6.length === 1)
        return filters6[0];

    filters6.unshift('all');
    return filters6;
};
