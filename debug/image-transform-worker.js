importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");
importScripts("https://cdn.jsdelivr.net/npm/d3-color@3");
importScripts("https://cdn.jsdelivr.net/npm/d3-interpolate@3");
importScripts("https://cdn.jsdelivr.net/npm/d3-scale-chromatic@3");

const UTILS = {
    transformImg: function ({params, img}) {
        if (params.interpolation === 'NONE') {
            return img;
        } else {
            const transformedImage = new Uint8Array(img.data);
            const MIN = params.min;
            const MAX = params.max;
            for(let i=0; i < img.data.length/4; i++) {
                const R = img.data[4 * i];
                const G = img.data[4 * i + 1];
                const B = img.data[4 * i + 2];
                const elevation = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1);
                const t = Math.min(1, Math.max(0, elevation / (MAX - MIN)));

                const transformedColor = d3.rgb(d3[`interpolate${params.interpolation}`](t));

                transformedImage[4 * i] = transformedColor.r;
                transformedImage[4 * i + 1] = transformedColor.g;
                transformedImage[4 * i + 2] = transformedColor.b;
            }

            return {width: img.width, height: img.height, data: transformedImage};
        }
    }
};

Comlink.expose(UTILS);