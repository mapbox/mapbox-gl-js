// @flow
import type {RGBAImage} from '../util/image';

export type SerializedDEMData = {
    uid: string,
    scale: number,
    levels: Array<ArrayBuffer>
};

class Level {
    width: number;
    height: number;
    border: number;
    stride: number;
    data: Int32Array;

    constructor(width: number, height: number, border: number, data: ?Int32Array) {
        if (height <= 0 || width <= 0) throw new RangeError('Level must have positive height and width');
        this.width = width;
        this.height = height;
        this.border = border;
        this.stride = this.width + 2 * this.border;
        this.data = data || new Int32Array((this.width + 2 * this.border) * (this.height + 2 * this.border));
    }

    set(x: number, y: number, value: number) {
        this.data[this.idx(x, y)] = value + 65536;
    }

    get(x: number, y: number) {
        return this.data[this.idx(x, y)] - 65536;
    }

    idx(x: number, y: number) {
        if (x < -this.border || x >= this.width + this.border ||  y < -this.border || y >= this.height + this.border) throw new RangeError('out of range source coordinates for DEM data');
        return (y + this.border) * this.stride + (x + this.border);
    }
}

class DEMData {
    uid: string;
    scale: number;
    data: Array<Level>;
    loaded: boolean;

    static deserialize(serializedData: SerializedDEMData) {
        const structdata = new Int32Array(serializedData.levels[0]);
        const stride = Math.sqrt(structdata.length);
        const data = [new Level(stride / 2, stride / 2, stride / 4, structdata)];
        return new DEMData(serializedData.uid, serializedData.scale, data);
    }

    constructor(uid: string, scale: ?number, data: ?Array<Level>) {
        this.uid = uid;
        this.scale = scale || 1;
        this.data = data ? data : [];
        this.loaded = !!data;
    }

    loadFromImage(data: RGBAImage) {
        // Build level 0
        this.data = [new Level(data.width, data.height, data.width / 2)];
        const level = this.data[0];
        const pixels = data.data;

        // unpack
        for (let y = 0; y < data.height; y++) {
            for (let x = 0; x < data.width; x++) {
                const i = y * data.width + x;
                const j = i * 4;
                // decoding
                level.set(x, y, this.scale * ((pixels[j] * 256 * 256 + pixels[j + 1] * 256.0 + pixels[j + 2]) / 10.0 - 10000.0));
            }
        }

        this.loaded = true;
    }

    serialize(transferables?: Array<Transferable>) {
        const references = {
            uid: this.uid,
            scale: this.scale,
            levels: []
        };


        if (transferables) transferables.push(this.data[0].data.buffer);
        references.levels.push(this.data[0].data.buffer);
        return references;
    }

    backfillBorders(borderTile: DEMData, dx: number, dy: number) {
        for (let l = 0; l < this.data.length; l++) {
            const t = this.data[l];
            const o = borderTile.data[l];

            if (t.width !== o.width) throw new Error('level mismatch (width)');
            if (t.height !== o.height) throw new Error('level mismatch (height)');


            let _xMin = dx * t.width,
                _xMax = dx * t.width + t.width,
                _yMin = dy * t.height,
                _yMax = dy * t.height + t.height;

            switch (dx) {
            case -1:
                _xMin = _xMax - 1;
                break;
            case 1:
                _xMax = _xMin + 1;
                break;
            }

            switch (dy) {
            case -1:
                _yMin = _yMax - 1;
                break;
            case 1:
                _yMax = _yMin + 1;
                break;
            }

            const xMin = clamp(_xMin, -t.border, t.width + t.border);
            const xMax = clamp(_xMax, -t.border, t.width + t.border);
            const yMin = clamp(_yMin, -t.border, t.height + t.border);
            const yMax = clamp(_yMax, -t.border, t.height + t.border);

            const ox = -dx * t.width;
            const oy = -dy * t.height;
            for (let y = yMin; y < yMax; y++) {
                for (let x = xMin; x < xMax; x++) {
                    t.set(x, y, o.get(x + ox, y + oy));
                }
            }
        }

        function clamp(value, min, max) {
            return value < min ? min : (value > max ? max : value);
        }
    }
}


module.exports = {DEMData, Level};

