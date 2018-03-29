
import { test } from 'mapbox-gl-js-test';
import renderColorRamp from '../../../src/util/color_ramp';
import { createPropertyExpression } from '../../../src/style-spec/expression';

const spec = {
    'function': true,
    'property-function': true,
    'type': 'color'
};

function pixelAt(image, i) {
    return image.data.slice(i * 4, (i + 1) * 4);
}

function nearlyEquals(a, b) {
    // we're actually looking for colors that are _almost_ equal, but don't
    // expect exact equal since 256 px need to represent a range from [0, 1]
    // (inclusive) -- the first and last pixel should be exact, the halfway
    // pixel may not be
    return a.every((e, i) => Math.abs(e - b[i]) <= 3);
}

test('renderColorRamp', (t) => {

    const expression = createPropertyExpression([
        'interpolate',
        ['linear'],
        ['line-progress'],
        0, 'rgba(0,0,255,0)',
        0.25, 'white',
        0.5, 'rgba(0,255,255,0.5)',
        0.75, 'black',
        1, 'red'
    ], spec, {handleErrors: false}).value;

    const ramp = renderColorRamp(expression, 'lineProgress');

    t.equal(ramp.width, 256);
    t.equal(ramp.height, 1);

    t.equal(pixelAt(ramp, 0)[3], 0, 'pixel at 0.0 matches input alpha');
    t.ok(nearlyEquals(pixelAt(ramp, 63), [255, 255, 255, 255]), 'pixel at 0.25 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 127), [0, 255, 255, 127]), 'pixel at 0.5 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 191), [0, 0, 0, 255]), 'pixel at 0.75 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 255), [255, 0, 0, 255]), 'pixel at 1.0 matches input');

    t.end();
});
