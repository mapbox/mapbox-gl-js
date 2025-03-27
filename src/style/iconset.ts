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

    addIcons(icons: StyleImageMap<string>) {
        for (const [name, image] of icons) {
            const imageId = ImageId.from({name, iconsetId: this.id});
            this.style.addImage(imageId, image);
        }
    }
}
