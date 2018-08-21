// @flow

import LngLat from './lng_lat';

import type {LngLatLike} from './lng_lat';

/**
 * `LngLatBounds` 对象表示一个地理上的边界框，由西南和东北两个经纬度点所定义。
 * 
 * 如果没有为构造器提供参数，将会创建一个为`null`的边界框。
 *
 * 任何接受 `LngLatBounds` 参数的 Mapbox GL 方法也同时接受两个由 {@link LngLatLike} 组成的数组，并会执行一个隐式转换。
 * 这种易变型的定义请参见 {@link LngLatBoundsLike}。
 * 
 * @param {LngLatLike} [sw] 边界框的西南角。
 * @param {LngLatLike} [ne] 边界框的东北角。
 * @example
 * var sw = new mapboxgl.LngLat(-73.9876, 40.7661);
 * var ne = new mapboxgl.LngLat(-73.9397, 40.8002);
 * var llb = new mapboxgl.LngLatBounds(sw, ne);
 */
class LngLatBounds {
    _ne: LngLat;
    _sw: LngLat;

    // This constructor is too flexible to type. It should not be so flexible.
    constructor(sw: any, ne: any) {
        if (!sw) {
            return;
        } else if (ne) {
            this.setSouthWest(sw).setNorthEast(ne);
        } else if (sw.length === 4) {
            this.setSouthWest([sw[0], sw[1]]).setNorthEast([sw[2], sw[3]]);
        } else {
            this.setSouthWest(sw[0]).setNorthEast(sw[1]);
        }
    }

    /**
     * 设置边界框的东北角坐标。
     *
     * @param {LngLatLike} ne
     * @returns {LngLatBounds} `this`
     */
    setNorthEast(ne: LngLatLike) {
        this._ne = ne instanceof LngLat ? new LngLat(ne.lng, ne.lat) : LngLat.convert(ne);
        return this;
    }

    /**
     * 设置边界框的西南角坐标。
     *
     * @param {LngLatLike} sw
     * @returns {LngLatBounds} `this`
     */
    setSouthWest(sw: LngLatLike) {
        this._sw = sw instanceof LngLat ? new LngLat(sw.lng, sw.lat) : LngLat.convert(sw);
        return this;
    }

    /**
     * 根据给定的 LngLat 或 LngLatBounds 扩展边界范围。
     *
     * @param {LngLat|LngLatBounds} obj 扩展对象
     * @returns {LngLatBounds} `this`
     */
    extend(obj: LngLat | LngLatBounds) {
        const sw = this._sw,
            ne = this._ne;
        let sw2, ne2;

        if (obj instanceof LngLat) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LngLatBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else {
            if (Array.isArray(obj)) {
                if (obj.every(Array.isArray)) {
                    return this.extend(LngLatBounds.convert(obj));
                } else {
                    return this.extend(LngLat.convert(obj));
                }
            }
            return this;
        }

        if (!sw && !ne) {
            this._sw = new LngLat(sw2.lng, sw2.lat);
            this._ne = new LngLat(ne2.lng, ne2.lat);

        } else {
            sw.lng = Math.min(sw2.lng, sw.lng);
            sw.lat = Math.min(sw2.lat, sw.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
        }

        return this;
    }

    /**
     * 返回距离边框等距的地理坐标点。
     *
     * @returns {LngLat} 边界框的中心点。
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
     */
    getCenter(): LngLat {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    }

    /**
     * 返回边界框的西南角坐标。
     *
     * @returns {LngLat} 边界框的西南角坐标。
     */
    getSouthWest(): LngLat { return this._sw; }

    /**
    * 返回边界框的东北角坐标。
    *
    * @returns {LngLat} 边界框的东北角坐标。
     */
    getNorthEast(): LngLat { return this._ne; }

    /**
    * 返回边界框的西北角坐标。
    *
    * @returns {LngLat} 边界框的西北角坐标。
     */
    getNorthWest(): LngLat { return new LngLat(this.getWest(), this.getNorth()); }

    /**
    * 返回边界框的东南角坐标。
    *
    * @returns {LngLat} 边界框的东南角坐标。
     */
    getSouthEast(): LngLat { return new LngLat(this.getEast(), this.getSouth()); }

    /**
    * 返回边界框的西边界。
    *
    * @returns {number} 边界框的西边界。
     */
    getWest(): number { return this._sw.lng; }

    /**
    * 返回边界框的南边界。
    *
    * @returns {number} 边界框的南边界。
     */
    getSouth(): number { return this._sw.lat; }

    /**
    * 返回边界框的东边界。
    *
    * @returns {number} 边界框的东边界。
     */
    getEast(): number { return this._ne.lng; }

    /**
    * 返回边界框的北边界。
    *
    * @returns {number} 边界框的北边界。
     */
    getNorth(): number { return this._ne.lat; }

    /**
     * 返回表示边界框的数组。
     *
     * @returns {Array<Array<number>>} 表示边界的数组, 它由代表西南角和东北角坐标的数值数组组成。
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
     */
    toArray() {
        return [this._sw.toArray(), this._ne.toArray()];
    }

    /**
     * 返回表示边界框的字符串。
     * 
     * @returns {string} 边界框字符串的格式为 
     *   `'LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))'`。
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
     */
    toString() {
        return `LngLatBounds(${this._sw.toString()}, ${this._ne.toString()})`;
    }

    /**
     * 检测边界框是否为空。
     *
     * @returns {boolean} True if bounds have been defined, otherwise false.
     * @returns {boolean} 已定义的边界返回ture，否则返回false。
     */
    isEmpty() {
        return !(this._sw && this._ne);
    }

    /**
     * 将数组转换为 `LngLatBounds` 对象。
     *
     * 如果传入 `LngLatBounds` 对象，会直接返回该对象。
     *
     * 在内部，它使用 `LngLat#convert` 将数组转换为 `LngLat` 值。
     *
     * @param {LngLatBoundsLike} input 包含两个坐标的数组，或者 `LngLatBounds` 对象。
     * @returns {LngLatBounds} 如果发生转换则返回一个新的 `LngLatBounds` 对象，否则将直接返回传入的 `LngLatBounds` 对象。
     * @example
     * var arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
     * var llb = mapboxgl.LngLatBounds.convert(arr);
     * llb;   // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
     */
    static convert(input: LngLatBoundsLike): LngLatBounds {
        if (!input || input instanceof LngLatBounds) return input;
        return new LngLatBounds(input);
    }
}

/**
 * 一个 {@link LngLatBounds} 对象、一个 {@link LngLatLike} 对象以 [西南，东北] 顺序组成的数组，或者
 * 一个以 [西, 南, 东, 北] 四个数值组成的数组。
 *
 * @typedef {LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number]} LngLatBoundsLike
 * @example
 * var v1 = new mapboxgl.LngLatBounds(
 *   new mapboxgl.LngLat(-73.9876, 40.7661),
 *   new mapboxgl.LngLat(-73.9397, 40.8002)
 * );
 * var v2 = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002])
 * var v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 */
export type LngLatBoundsLike = LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number];

export default LngLatBounds;
