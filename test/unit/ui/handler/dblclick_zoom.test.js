import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', (t) => {
    const map = createMap(t);

    map.on('dblclick', e => e.preventDefault());

    const zoom = t.spy();
    map.on('zoom', zoom);

    simulate.dblclick(map.getCanvas());

    t.equal(zoom.callCount, 0);

    map.remove();
    t.end();
});
