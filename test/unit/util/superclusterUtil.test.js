'use strict';
// @flow

const test = require('mapbox-gl-js-test').test;
const superclusterUtil = require('../../../src/util/superclusterUtil');

test('util', (t) => {
    const options = {
        aggregateBy: ['casualities', 'wounded'],
        groupBy: 'incidentType'
    };
    const features = [
        {properties: {casualities: 10, wounded: 5, incidentType: 'accident'}, geometry: {}, type: 'Point'},
        {properties: {casualities: 50, wounded: 15, incidentType: 'explosion'}, geometry: {}, type: 'Point'},
        {properties: {casualities: 5, wounded: 5, incidentType: 'explosion'}, geometry: {}, type: 'Point'},
        {properties: {casualities: 0, wounded: 1, incidentType: 'explosion'}, geometry: {}, type: 'Point'}
    ];

    const mapReduceParams = superclusterUtil.getMapReduceParams(options);

    // Assert initial function
    const initialClusterProperties = mapReduceParams.initial();
    t.deepEqual(initialClusterProperties, {
        'casualities': 0,
        'casualities_abbrev': '0',
        'casualities_group': {},
        'wounded': 0,
        'wounded_abbrev': '0',
        'wounded_group': {},
    });

    // Assert map function
    const mappedProperties = features.map((feature) => {
        return mapReduceParams.map(feature.properties);
    });
    t.deepEqual(mappedProperties, [{
        'casualities': 10,
        'casualities_abbrev': '10',
        'casualities_group': {
            'accident': 10
        },
        'wounded': 5,
        'wounded_abbrev': '5',
        'wounded_group': {
            'accident': 5
        }
    },
    {
        'casualities': 50,
        'casualities_abbrev': '50',
        'casualities_group': {
            'explosion': 50
        },
        'wounded': 15,
        'wounded_abbrev': '15',
        'wounded_group': {
            'explosion': 15
        }
    },
    {
        'casualities': 5,
        'casualities_abbrev': '5',
        'casualities_group': {
            'explosion': 5
        },
        'wounded': 5,
        'wounded_abbrev': '5',
        'wounded_group': {
            'explosion': 5
        }
    },
    {
        'casualities': 0,
        'casualities_abbrev': '0',
        'casualities_group': {
            'explosion': 0
        },
        'wounded': 1,
        'wounded_abbrev': '1',
        'wounded_group': {
            'explosion': 1
        }
    }
    ]);

    // Assert reduce function
    const reducedFeature = mappedProperties.reduce((accumulated, props) => {
        return mapReduceParams.reduce(accumulated, props);
    }, initialClusterProperties);

    t.deepEqual(reducedFeature, {
        'casualities': 65,
        'casualities_abbrev': '65',
        'casualities_group': {
            accident: 10,
            explosion: 55
        },
        'wounded': 26,
        'wounded_abbrev': '26',
        'wounded_group': {
            accident: 5,
            explosion: 21
        }
    });

    t.end();
});
