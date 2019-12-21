// @flow

import Handler from './handler';
import Inertia from './inertia';
import DOM from '../../util/dom';
import window from '../../util/window';
import browser from '../../util/browser';

import type Map from '../map';
import type Transform from '../../geo/transform';
import type Point from '@mapbox/point-geometry';


class TouchHandler extends Handler {
  _el: HTMLElement;
  _transform: Transform;
  _startTouchEvent: ?TouchEvent;
  _startTouchData: ?Object;
  _startTime: ?number;
  _lastTouchEvent: ?TouchEvent;
  _lastTouchData: ?Object;

  constructor(map: Map, options: ?Object) {
    super(map, options);
    this._transform = map.transform;
  }

  _getTouchEventData(e: TouchEvent) {
      if (!e.touches) throw new Error('no touches', e);
      const isMultiTouch = e.touches.length > 1;
      let points = DOM.touchPos(this._el, e);
      const centerPoint = isMultiTouch ? points[0].add(points[1]).div(2) : points[0];
      const centerLocation = this._transform.pointLocation(centerPoint);
      const vector = isMultiTouch ? points[0].sub(points[1]) : null ;
      return { isMultiTouch, points, centerPoint, centerLocation, vector };
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

    get _threshold() {
      return this._state === 'active' ? 0 : 0.15;
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
      // TODO check time vs. start time to prevent responding to spurious events (vs. tap)
      const scale = this._lastTouchData.vector.mag() / this._startTouchData.vector.mag();
      if (Math.abs(1 - scale) > this._threshold) {
        this._state = 'active';
        const zoomDelta = this._transform.scaleZoom(scale);
        const aroundLocation = this._lastTouchData.centerLocation;
        const aroundPoint = this._lastTouchData.centerPoint;
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        return { transform: { zoomDelta, setLocationAtPoint: [aroundLocation, aroundPoint] }};
      }
    }
}

class TouchRotateHandler extends TouchHandler {

    get _threshold() {
      return 0;
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
      // TODO check time vs. start time to prevent responding to spurious events?
      const bearingDelta = this._lastTouchData.vector.angleWith(this._startTouchData.vector) * 180 / Math.PI

      this._startTouchEvent = this._lastTouchEvent;
      this._startTouchData = this._lastTouchData;
      this._startTime = browser.now();

      if (Math.abs(bearingDelta) > this._threshold) {
        this._state = 'active';
        const aroundLocation = this._lastTouchData.centerLocation;
        const aroundPoint = this._lastTouchData.centerPoint;
        return { transform: { bearingDelta, setLocationAtPoint: [aroundLocation, aroundPoint] }};
      } else {
        this._state = 'pending'
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
      const pitchDelta = (this._startTouchData.centerPoint.y - this._lastTouchData.centerPoint.y) * 0.5;

      this._startTouchEvent = this._lastTouchEvent;
      this._startTouchData = this._lastTouchData;
      this._startTime = browser.now();

      if (Math.abs(pitchDelta) > 0) {
        this._state = 'active';
        // const aroundLocation = this._lastTouchData.centerLocation;
        // const aroundPoint = this._lastTouchData.centerPoint;
        return { transform: { pitchDelta}};
      } else {
        this._state = 'pending';
      }
    }
}


export { TouchHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler };
