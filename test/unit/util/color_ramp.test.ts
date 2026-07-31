// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {renderColorRamp} from '../../../src/util/color_ramp';
import {createPropertyExpression, type StylePropertyExpression} from '../../../src/style-spec/expression/index';

import type {RGBAImage} from '../../../src/util/image.ts';

const spec = {
    'function': true,
    'property-function': true,
    'type': 'color',
    "expression": {
        "parameters": [
            "line-progress"
        ]
    }
};

function pixelAt(image, i) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return image.data.slice(i * 4, (i + 1) * 4);
}

function nearlyEquals(a, b) {
    // we're actually looking for colors that are _almost_ equal, but don't
    // expect exact equal since 256 px need to represent a range from [0, 1]
    // (inclusive) -- the first and last pixel should be exact, the halfway
    // pixel may not be
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(pixelAt(ramp, 0)[3]).toEqual(127);
    expect(nearlyEquals(pixelAt(ramp, 50), [255, 0, 0, 127])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 53), [0, 0, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 103), [255, 0, 0, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 160), [0, 0, 255, 255])).toBeTruthy();
    expect(nearlyEquals(pixelAt(ramp, 256), [255, 255, 255, 255])).toBeTruthy();
});

describe('renderColorRamp scale', () => {
    // colors of the step expression below, in ramp order
    const rasterColors = {
        red: [255, 0, 0, 255],
        yellow: [255, 255, 0, 255],
        green: [0, 128, 0, 255],
        blue: [0, 0, 255, 255]
    } as const;

    const rgba = ([r, g, b, a]: number[]): string => `rgba(${r}, ${g}, ${b}, ${a / 255})`;

    const createRasterColorExpression = (): StylePropertyExpression =>  {
        const rasterSpec = {
            'type': 'color',
            'property-type': 'color-ramp',
            'expression': {
                'parameters': [
                    'raster-value'
                ]
            }
        };

        return createPropertyExpression([
            'step',
            ['raster-value'],
            rgba(rasterColors.red),
            0.25, rgba(rasterColors.yellow),
            0.5, rgba(rasterColors.green),
            0.75, rgba(rasterColors.blue)
        ], rasterSpec, {handleErrors: false}).value;
    };

    const texelColors = (image: RGBAImage, indices: number[]): number[][] => indices.map((i) => [...image.data.slice(i * 4, i * 4 + 4)]);

    // Indices of the texels where the baked step ramp switches color.
    const breakpointTexels = (image: RGBAImage): number[] =>  {
        const indices: number[] = [];
        for (let i = 1; i < image.width; i++) {
            if (!nearlyEquals(pixelAt(image, i), pixelAt(image, i - 1))) indices.push(i);
        }
        return indices;
    };

    test("'linear' spaces texels evenly across the range", () => {
        const {red, yellow, green, blue} = rasterColors;
        const ramp = renderColorRamp({expression: createRasterColorExpression(), evaluationKey: 'rasterValue'});

        // texels are evenly spaced
        expect(breakpointTexels(ramp)).toEqual([64, 128, 192]);
        // check start and end texel
        expect(texelColors(ramp, [0, 255])).toEqual([red, blue]);
        // check texels around the breakpoints
        expect(texelColors(ramp, [63, 64, 127, 128, 191, 192])).toEqual([red, yellow, yellow, green, green, blue]);
    });

    test("'log' spaces texels exponentially", () => {
        const {red, yellow, green, blue} = rasterColors;
        const ramp = renderColorRamp({expression: createRasterColorExpression(), evaluationKey: 'rasterValue', scale: 'log'});

        // texels are spaced exponentially
        expect(breakpointTexels(ramp)).toEqual([131, 189, 227]);
        // check start and end texel
        expect(texelColors(ramp, [0, 255])).toEqual([red, blue]);
        // check texels around the breakpoints
        expect(texelColors(ramp, [130, 131, 188, 189, 226, 227])).toEqual([red, yellow, yellow, green, green, blue]);
    });
});
