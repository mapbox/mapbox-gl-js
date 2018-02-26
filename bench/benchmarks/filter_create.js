// @flow

import Benchmark from '../lib/benchmark';

import createFilter from '../../src/style-spec/feature_filter';
import filters from '../data/filters.json';

module.exports = class FilterCreate extends Benchmark {
    bench() {
        for (const filter of filters) {
            createFilter(filter.filter);
        }
    }
};
