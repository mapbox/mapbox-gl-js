import {ImageId} from '../style-spec/expression/types/image_id';

import type Style from './style';
import type {StyleImage} from './style_image';

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

    addImages(images: Array<{layerId: string, bandId: string, img: StyleImage}>) {
        for (const {layerId, bandId, img} of images) {
            const imageId = ImageId.from({name: `${layerId}/${bandId}`, iconsetId: this.id});
            this.style.addImage(imageId, img);
        }
    }
}
