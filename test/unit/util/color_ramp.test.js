import {test, expect} from "../../util/vitest.js";
import {renderColorRamp} from '../../../src/util/color_ramp.js';
import {createPropertyExpression} from '../../../src/style-spec/expression/index.js';

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

test('renderColorRamp linear', () => {
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

    expect(ramp.width).toEqual(256);
    expect(ramp.height).toEqual(1);

    expect(pixelAt(ramp, 0)[3]).toEqual(0);
    expect(nearlyEquals(pixelAt(ramp, 63), [255, 255, 255, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 127), [0, 255, 255, 127])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 191), [0, 0, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 255), [255, 0, 0, 255])).toBeTruthy();
});

test('renderColorRamp step', () => {
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

    expect(ramp.width).toEqual(512);
    expect(ramp.height).toEqual(1);

    expect(pixelAt(ramp, 0)[3]).toEqual(25);
    expect(nearlyEquals(pixelAt(ramp, 50), [0, 0, 255, 25])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 53), [255, 0, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 103), [255, 255, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 160), [255, 255, 255, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 256), [0, 0, 0, 255])).toBeTruthy();
});

test('renderColorRamp usePlacement', () => {
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

    expect(ramp.width).toEqual(512);
    expect(ramp.height).toEqual(1);

    renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512, image: ramp});

    expect(pixelAt(ramp, 0)[3]).toEqual(127);
    expect(nearlyEquals(pixelAt(ramp, 50), [255, 0, 0, 127])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 53), [0, 0, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 103), [255, 0, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 160), [0, 0, 255, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 256), [255, 255, 255, 255])).toBeTruthy();
});
