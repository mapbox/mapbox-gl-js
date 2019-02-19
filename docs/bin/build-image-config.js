#!/usr/bin/env node
// builds image.config.json
// this configuration file is required to generate the appropriate images sizes with docs/bin/appropriate-images.js
// it is also required in react component that loads the image in components/appropriate-image.js
const imagePath = './docs/img/src/';

const imageConfig = require('fs').readdirSync(imagePath).reduce((obj, image) => {
    const ext = require('path').extname(`${imagePath}${image}`);
    // only process png
    if (ext === '.png') {
        const key = image.replace(ext, '');
        // set sizes for all images
        const sizes = [{ width: 800 }, { width: 500 }];
        // set additional sizes for specific images
        if (key === 'simple-map') sizes.push({ width: 1200 });
        obj[key] = {
            basename: image,
            sizes
        };
    }
    return obj;
}, {});

require('fs').writeFileSync('./docs/img/dist/image.config.json', JSON.stringify(imageConfig));
