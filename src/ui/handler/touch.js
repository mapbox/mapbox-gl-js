// @flow

import Handler from './handler';
import Inertia from './inertia';
import DOM from '../../util/dom';
import window from '../../util/window';
import browser from '../../util/browser';

import type Map from '../map';
import type Point from '@mapbox/point-geometry';


class TouchHandler extends Handler {
  _el: HTMLElement;
  _startTouchEvent: ?TouchEvent;
  _startTouchData: ?Object;
  _startTime: ?number;
  _lastTouchEvent: ?TouchEvent;
  _lastTouchData: ?Object;

  /**
   * @private
   */
  constructor(map: Map, options?: Object) {
    super(map, options);
    this._el = this._map.getCanvasContainer();

  }

  _getTouchEventData(e: TouchEvent) {
      const isMultiTouch = e.touches.length > 1;
      let points = [];
      for (let i = 0; i < e.touches.length; i++) {
        points.push(DOM.mousePos(this._el, e.touches[i]));
      }
      const center = isMultiTouch ? points[0].add(points[1]).div(2) : points[0];
      const vector = isMultiTouch ? points[0].sub(points[1]) : null ;
      return { isMultiTouch, points, center, vector };
  }


  touchstart(e: TouchEvent) {
    if (!this.isEnabled()) return;
    this._startTouchEvent = e;
    this._startTouchData = this._getTouchEventData(e);
    this._startTime = browser.now();
  };

  // touchmove(e: TouchEvent) {
  //
  // }
  //
  // _onTouchCancel(e: TouchEvent) {
  //
  // }


}

class TouchZoomHandler extends TouchHandler {
    significantScaleThreshold: number;
    _startScale: ?number;

    constructor(map: Map, options?: Object) {
      super(map, options);
      this.significantScaleThreshold = 0.15;
    }

    touchstart(e: TouchEvent) {
      super.touchstart(e);
      if (!this._startTouchData.isMultiTouch) return;
      this._state = 'pending';
      this._startScale = this._map.transform.scale;
    }

    touchmove(e: TouchEvent) {
      if (!(this._state === 'pending' || this._state === 'active')) return;
      if (!this._startTouchData) return this.touchstart(e);
      this._lastTouchEvent = e;
      this._lastTouchData = this._getTouchEventData(e);
      if (!this._lastTouchData.isMultiTouch) return;
      // TODO check time vs. start time to prevent responding to spurious events (vs. tap)
      const scale = this._lastTouchData.vector.mag() / this._startTouchData.vector.mag();
      const scalingSignificantly = Math.abs(1 - scale) > this.significantScaleThreshold;
      if (scalingSignificantly) {
        this._state = 'active';
        const newZoom = this._map.transform.scaleZoom(this._startScale * scale);
        return { transform: { zoom : newZoom }};
      }
    }
}

class TouchRotateHandler extends TouchHandler {
    significantRotateThreshold: number;
    _startBearing: ?number;

    constructor(map: Map, options?: Object) {
      super(map, options);
      this.significantRotateThreshold = 10;
    }

    touchstart(e: TouchEvent) {
      super.touchstart(e);
      if (!this._startTouchData.isMultiTouch) return;
      this._state = 'pending';
      this._startBearing = this._map.transform.bearing;
    }

    touchmove(e: TouchEvent) {
      if (!(this._state === 'pending' || this._state === 'active')) return;
      if (!this._startTouchData) return this.touchstart(e);
      this._lastTouchEvent = e;
      this._lastTouchData = this._getTouchEventData(e);
      if (!this._lastTouchData.isMultiTouch) return;
      // TODO check time vs. start time to prevent responding to spurious events (vs. tap)
      const bearing = this._lastTouchData.vector.angleWith(this._startTouchData.vector) * 180 / Math.PI
      const rotatingSignificantly = Math.abs(bearing) > this.significantRotateThreshold;
      if (rotatingSignificantly) {
        this._state = 'active';
        const newBearing = this._startBearing + bearing;
        return { transform: { bearing : newBearing }};
      }
    }
}


export { TouchHandler, TouchZoomHandler, TouchRotateHandler };
