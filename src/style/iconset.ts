import {ImageId} from '../style-spec/expression/types/image_id';

import type Style from './style';
import type {StyleImageMap} from './style_image';

export class Iconset {
    id: string;
    style: Style;

    /**
     * @private
     */
    constructor(id: string, style: Style) {
        this.id = id;
        this.style = style;
    }

    addIcons(images: StyleImageMap<string>) {
        const icons = new Map();
        for (const [name, image] of images.entries()) {
            const imageId = ImageId.from({name, iconsetId: this.id});
            icons.set(imageId, image);
        }

        this.style.addImages(icons);
    }
}
