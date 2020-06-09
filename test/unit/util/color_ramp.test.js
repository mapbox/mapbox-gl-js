
import {test} from '../../util/test';
import {renderColorRamp} from '../../../src/util/color_ramp';
import {createPropertyExpression} from '../../../src/style-spec/expression';

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

test('renderColorRamp linear', (t) => {

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

    const ramp = renderColorRamp({expression, evaluationKey: 'lineProgress'});

    t.equal(ramp.width, 256);
    t.equal(ramp.height, 1);

    t.equal(pixelAt(ramp, 0)[3], 0, 'pixel at 0.0 matches input alpha');
    t.ok(nearlyEquals(pixelAt(ramp, 63), [255, 255, 255, 255]), 'pixel at 0.25 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 127), [0, 255, 255, 127]), 'pixel at 0.5 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 191), [0, 0, 0, 255]), 'pixel at 0.75 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 255), [255, 0, 0, 255]), 'pixel at 1.0 matches input');

    t.end();
});

test('renderColorRamp step', (t) => {

    const expression = createPropertyExpression([
        'step',
        ['line-progress'],
        'rgba(0, 0, 255, 0.1)',
        0.1, 'red',
        0.2, 'yellow',
        0.3, 'white',
        0.5, 'black',
        1, 'black'
    ], spec, {handleErrors: false}).value;

    const ramp = renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512});

    t.equal(ramp.width, 512);
    t.equal(ramp.height, 1);

    t.equal(pixelAt(ramp, 0)[3], 25, 'pixel at 0.0 matches input alpha');
    t.ok(nearlyEquals(pixelAt(ramp, 50), [0, 0, 255, 25]), 'pixel < 0.1 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 53), [255, 0, 0, 255]), 'pixel > 0.1 & < 0.2 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 103), [255, 255, 0, 255]), 'pixel > 0.2 & < 0.3 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 160), [255, 255, 255, 255]), 'pixel > 0.3 & < 0.5 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 256), [0, 0, 0, 255]), 'pixel > 0.5 matches input');

    t.end();
});

test('renderColorRamp usePlacement', (t) => {

    const expression = createPropertyExpression([
        'step',
        ['line-progress'],
        'rgba(255, 0, 0, 0.5)',
        0.1, 'black',
        0.2, 'red',
        0.3, 'blue',
        0.5, 'white',
        1, 'white'
    ], spec, {handleErrors: false}).value;

    const ramp = renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512});

    t.equal(ramp.width, 512);
    t.equal(ramp.height, 1);

    renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512, image: ramp});

    t.equal(pixelAt(ramp, 0)[3], 127, 'pixel at 0.0 matches input alpha');
    t.ok(nearlyEquals(pixelAt(ramp, 50), [255, 0, 0, 127]), 'pixel < 0.1 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 53), [0, 0, 0, 255]), 'pixel > 0.1 & < 0.2 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 103), [255, 0, 0, 255]), 'pixel > 0.2 & < 0.3 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 160), [0, 0, 255, 255]), 'pixel > 0.3 & < 0.5 matches input');
    t.ok(nearlyEquals(pixelAt(ramp, 256), [255, 255, 255, 255]), 'pixel > 0.5 matches input');

    t.end();
});
