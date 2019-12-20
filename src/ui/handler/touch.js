// @flow

import Handler from './handler';
import Inertia from './inertia';
import DOM from '../../util/dom';
import window from '../../util/window';
import browser from '../../util/browser';
import Transform from '../../geo/transform';

import type Point from '@mapbox/point-geometry';


class TouchHandler extends Handler {
  _el: HTMLElement;
  _startTouchEvent: ?TouchEvent;
  _startTouchData: ?Object;
  _startTime: ?number;
  _lastTouchEvent: ?TouchEvent;
  _lastTouchData: ?Object;

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

    touchstart(e: TouchEvent) {
      super.touchstart(e);
      if (!this._startTouchData.isMultiTouch) return;
      this._state = 'pending';
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
        const zoomDelta = Transform.prototype.scaleZoom(scale);
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        return { transform: { zoomDelta }};
      }
    }
}

class TouchRotateHandler extends TouchHandler {

    touchstart(e: TouchEvent) {
      super.touchstart(e);
      if (!this._startTouchData.isMultiTouch) return;
      this._state = 'pending';
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
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        return { transform: { bearingDelta }};
      }
    }
}

class TouchPitchHandler extends TouchHandler {
    _horizontalThreshold: number;

    constructor(el: HTMLElement, options?: Object) {
      super(el, options);
      this._horizontalThreshold = 50;
    }

    _pointsAreHorizontal(pointA, pointB) {
      return Math.abs(pointA.y - pointB.y) < this._horizontalThreshold;
    }

    touchstart(e: TouchEvent) {
      super.touchstart(e);
      if (!this._startTouchData.isMultiTouch) return;
      this._state = 'pending';
    }

    touchmove(e: TouchEvent) {
      if (!(this._state === 'pending' || this._state === 'active')) return;
      if (!this._startTouchData) return this.touchstart(e);
      this._lastTouchEvent = e;
      this._lastTouchData = this._getTouchEventData(e);
      if (!this._lastTouchData.isMultiTouch) return;
      const isHorizontal = this._pointsAreHorizontal(this._lastTouchData.points[0], this._lastTouchData.points[1]);
      if (!isHorizontal) return;
      const pitchDelta = (this._startTouchData.center.y - this._lastTouchData.center.y) * 0.5;

      if (Math.abs(pitchDelta) > 0) {
        this._state = 'active';
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        return { transform: { pitchDelta }};
      }
    }
}


export { TouchHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler };
