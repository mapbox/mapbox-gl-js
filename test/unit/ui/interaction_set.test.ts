import {describe, test, expect} from '../../util/vitest';
import {InteractionSet} from '../../../src/ui/interactions';
import {Evented} from '../../../src/util/evented';

function feature(json) {
    return {
        ...json,
        _vectorTileFeature: {},
        clone() { return this; }
    };
}

describe('InteractionSet', () => {
    test('#add', () => {
        const map = new Evented();

        const featureset = {layerId: 'foo'};
        const layer = {id: featureset.layerId};

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.style = {
            queryRenderedTargets: () => [
                feature({id: 1, layer, variants: {test: [{target: featureset}]}}),
            ]
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.getFeatureState = () => ({});

        const interactions = new InteractionSet(map);

        let clickHandled = false;

        interactions.add('test', {
            type: 'click',
            target: featureset,
            handler(e) {
                expect(e.interaction.type).toEqual('click');
                expect(e.feature.id).toEqual(1);
                clickHandled = true;
            }
        });

        map.fire('click');
        expect(clickHandled).toBeTruthy();
    });

    test('propagates to next feature if false returned in handler', () => {
        const map = new Evented();
        const interactions = new InteractionSet(map);

        const featureset = {layerId: 'foo'};
        const layer = {id: featureset.layerId};

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.style = {
            queryRenderedTargets: () => [
                feature({id: 1, layer, variants: {test: [{target: featureset}]}}),
                feature({id: 2, layer, variants: {test: [{target: featureset}]}})
            ]
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.getFeatureState = () => ({});

        let clickHandled = false;

        interactions.add('test', {
            type: 'click',
            target: featureset,
            handler(e) {
                if (e.feature.id === 1) return false;
                expect(e.feature.id).toEqual(2);
                clickHandled = true;
            }
        });

        map.fire('click');
        expect(clickHandled).toBeTruthy();
    });

    test('#remove', () => {
        const map = new Evented();
        const interactions = new InteractionSet(map);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.style = {
            queryRenderedTargets: () => []
        };

        let clickHandled = false;

        interactions.add('test', {
            type: 'click',
            handler(e) {
                clickHandled = true;
            }
        });

        interactions.remove('test');

        map.fire('click');
        expect(clickHandled).toBeFalsy();
    });

    test('respects featureset and filter', () => {
        const map = new Evented();
        const interactions = new InteractionSet(map);

        const featureset = {layerId: 'bar'};
        const layer = {id: featureset.layerId};

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.style = {
            queryRenderedTargets: (_, featuresetQueryTargets) => {
                expect(featuresetQueryTargets[0].filter.filter).toBeTruthy();
                return [
                    feature({id: 3, layer, variants: {test: [{target: featureset, properties: {cool: true}}]}}),
                ];
            }
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        map.getFeatureState = () => ({});

        let clickHandled = false;

        interactions.add('test', {
            type: 'click',
            target: featureset,
            filter: ['==', ['get', 'cool'], true],
            handler(e) {
                expect(e.feature.id).toEqual(3);
                clickHandled = true;
            }
        });

        map.fire('click');
        expect(clickHandled).toBeTruthy();
    });
});
