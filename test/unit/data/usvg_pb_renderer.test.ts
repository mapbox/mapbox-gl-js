import {describe, test, expect} from '../../util/vitest';
import {renderIcon} from '../../../src/data/usvg/usvg_pb_renderer';
import {LineCap, PathCommand} from '../../../src/data/usvg/usvg_pb_decoder';
import {Color} from '../../../src/style-spec/style-spec';

import type {Icon, Path, Stroke} from '../../../src/data/usvg/usvg_pb_decoder';

const {PATH_COMMAND_LINE: L, PATH_COMMAND_QUAD: Q, PATH_COMMAND_CUBIC: C, PATH_COMMAND_CLOSE: Z} = PathCommand;

// Strokes one 10px wide path on a 40x40 icon; diffs start with the absolute start point
function renderStroke(commands: Path['commands'], diffs: number[], linecap: Stroke['linecap']): ImageData {
    const icon: Icon = {
        name: 'stroke',
        'usvg_tree': {
            width: 40,
            height: 40,
            children: [{
                node: 'path',
                path: {
                    'paint_order': 1,
                    commands,
                    step: 1,
                    diffs,
                    stroke: {'rgb_color': new Color(0, 0, 0, 1), paint: 'rgb_color', dasharray: [], dashoffset: 0, miterlimit: 4, opacity: 255, width: 10, linecap, linejoin: 1}
                }
            }],
            'linear_gradients': [],
            'radial_gradients': [],
            'clip_paths': [],
            masks: []
        }
    };
    return renderIcon(icon, {sx: 1, sy: 1, params: {}});
}

function alphaAt(image: ImageData, x: number, y: number): number {
    return image.data[(y * image.width + x) * 4 + 3];
}

describe('renderIcon zero-length subpaths', () => {
    // Open zero-length lines are covered by the uSVG suite's stroke-linecap_zero-length-path-* fixtures
    test.each([
        ['M Z', [Z], [20, 20]],
        ['M L Z', [L, Z], [20, 20, 0, 0]],
        ['M Q', [Q], [20, 20, 0, 0, 0, 0]],
        ['M C', [C], [20, 20, 0, 0, 0, 0, 0, 0]],
    ])('%s draws a round cap', (_, commands: Path['commands'], diffs) => {
        expect(alphaAt(renderStroke(commands, diffs, LineCap.LINE_CAP_ROUND), 20, 20)).toEqual(255);
    });

    test('segments after a closed zero-length subpath start from its start point', () => {
        const image = renderStroke([L, Z, L], [10, 20, 0, 0, 20, 0], LineCap.LINE_CAP_ROUND);
        expect(alphaAt(image, 8, 20)).toEqual(255);
        expect(alphaAt(image, 20, 20)).toEqual(255);
    });
});
