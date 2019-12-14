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
      if (!e.touches) throw new Error('no touches', e);
      const isMultiTouch = e.touches.length > 1;
      let points = DOM.touchPos(this._el, e);
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
  touchend(e: TouchEvent) {
    this.deactivate();
  }
  //
  touchcancel(e: TouchEvent) {
    this.deactivate();
  }

  deactivate() {
    delete this._startTouchEvent;
    delete this._startTouchData;
    delete this._startTime;
    delete this._lastTouchEvent;
    delete this._lastTouchData;
    if (this._state === 'pending' || this._state === 'active') {
      this._state = 'enabled';
    }
  }


}

class TouchZoomHandler extends TouchHandler {
    _startScale: ?number;

    constructor(map: Map, options?: Object) {
      super(map, options);
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
      if (scale !== 1) {
        this._state = 'active';
        const newZoom = this._map.transform.scaleZoom(this._startScale * scale);
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        this._startScale = this._startScale * scale;
        return { transform: { zoom : newZoom }};
      }
    }

    deactivate() {
      delete this._startScale;
      super.deactivate();
    }
}

class TouchRotateHandler extends TouchHandler {
    _startBearing: ?number;

    constructor(map: Map, options?: Object) {
      super(map, options);
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
      // TODO check time vs. start time to prevent responding to spurious events?
      const bearingDelta = this._lastTouchData.vector.angleWith(this._startTouchData.vector) * 180 / Math.PI
      if (Math.abs(bearingDelta) > 0) {
        this._state = 'active';
        const newBearing = this._startBearing + bearingDelta;
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        this._startBearing = newBearing;
        return { transform: { bearing : newBearing }};
      }
    }

    deactivate() {
      delete this._startBearing;
      super.deactivate();
    }
}


export { TouchHandler, TouchZoomHandler, TouchRotateHandler };
