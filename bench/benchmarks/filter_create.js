// @flow

const Benchmark = require('../lib/benchmark');
const createFilter = require('../../src/style-spec/feature_filter');
const filters = require('../data/filters.json');

module.exports = class FilterCreate extends Benchmark {
    bench() {
        for (const filter of filters) {
            createFilter(filter.filter);
        }
    }
};
