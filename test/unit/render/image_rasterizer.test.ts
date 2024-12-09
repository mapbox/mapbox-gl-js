import {expect, describe, test, vi} from '../../util/vitest';
import {ImageRasterizer} from '../../../src/render/image_rasterizer';
import {Color} from '../../../src/style-spec/style-spec';
import {ImageIdWithOptions} from '../../../src/style-spec/expression/types/image_id_with_options';

import type {Icon} from '../../../src/data/usvg/usvg_pb_decoder';
import type {StyleImage} from '../../../src/style/style_image';

describe('ImageRasterizer', () => {
    const icon: Icon = {
        "name": "square",
        "usvg_tree": {
            "width": 20,
            "children": [
                {
                    "path": {
                        "paint_order": 1,
                        "commands": [
                            2,
                            2,
                            2
                        ],
                        "step": 20,
                        "diffs": [
                            0,
                            0,
                            1,
                            0,
                            0,
                            1,
                            -1,
                            0
                        ],
                        "rule": 1,
                        "fill": {
                            "rgb_color": new Color(0, 0, 0, 1),
                            "paint": "rgb_color",
                            "opacity": 255
                        }
                    },
                    "node": "path"
                }
            ],
            "linear_gradients": [],
            "radial_gradients": [],
            "clip_paths": [],
            "masks": [],
            "height": 20
        },
        "data": "usvg_tree"
    };

    const image: StyleImage = {
        icon,
        version: 1,
        pixelRatio: 1,
        sdf: false,
        usvg: true
    };

    test('expects returns rasterized image', () => {
        expect(new ImageRasterizer().rasterize(new ImageIdWithOptions('square'), image, '', '1').data.length).toEqual(1600);
    });

    test('expects returns rasterized image from cache', () => {
        const imageIdWithOptions = new ImageIdWithOptions('square');
        const imageRasterizer = new ImageRasterizer();
        const rasterizer = vi.fn();

        imageRasterizer.rasterize(imageIdWithOptions, image, '', '1');
        imageRasterizer.rasterize(imageIdWithOptions, image, '', '1', rasterizer);

        expect(rasterizer).not.toHaveBeenCalled();
    });
});

