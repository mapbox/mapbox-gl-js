// @flow

import {bezier, extend} from '../../util/util';
import type Point from '@mapbox/point-geometry';

const defaultInertiaOptions = {
    linearity: 0.3,
    easing: bezier(0, 0, 0.3, 1),
    maxSpeed: 1400,
    deceleration: 2500,
};
export type InertiaOptions = typeof defaultInertiaOptions;

export type InertiaEntry = {
  time: number,
  point?: Point,
  zoom?: number,
  bearing?: number,
  pitch?: number
};

class Inertia {
  _buffer: Array<InertiaEntry>;
  _options: InertiaOptions;
  _drainCutoff: number;

  constructor(options?: InertiaOptions) {
    this._buffer = [];
    this.setOptions(extend(defaultInertiaOptions, options));
    this._drainCutoff = 160;  // msec
  }

  setOptions(options: InertiaOptions) {
    extend(this._options, options);
  }

  getOptions() {
    return this._options;
  }

  push(entry: InertiaEntry) {
    this._buffer.push(entry);
  }

  drain() {
    const now = browser.now();
    while (this._buffer.length > 0 && now - inertia[0].time > cutoff) this._buffer.shift();
  }

  calculatePan() {

  }

  calculateRotate() {

  }

  calculateZoom() {

  }

  calculatePitch() {
    
  }

}

export default Inertia;
