import { scopeAppropriateImage } from '@mapbox/appropriate-images-react';
import imageConfig from '../conf/image.config.js';

// See https://github.com/mapbox/appropriate-images-react#appropriateimage
// The required prop is `imageId`, which must correspond to a key in the
// imageConfig.
const AppropriateImage = scopeAppropriateImage(imageConfig, {
    transformUrl: url => require(`../img/dist/${url}`)
});

export default AppropriateImage;
