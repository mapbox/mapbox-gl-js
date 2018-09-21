// @flow

import Benchmark from '../lib/benchmark';

import createFilter from '../../src/style-spec/feature_filter';
import filters from '../data/expression_filters2.json';

export default class FilterCreateExpressions extends Benchmark {
    bench() {
        for (const filter of filters) {
            createFilter(filter.filter);
        }
    }
}
