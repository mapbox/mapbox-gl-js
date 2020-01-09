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

  _setStartTouch(e: TouchEvent) {
    this._startTouchEvent = e;
    this._startTouchData = this._getTouchEventData(e);
    this._startTime = browser.now();
  }

  touchstart(e: TouchEvent) {
    if (!this.isEnabled()) return;
    this._setStartTouch(e);
    if (this._state !== 'active') this._state = 'pending';
  };

  touchmove(e: TouchEvent) {
    if (!(this._state === 'pending' || this._state === 'active')) return;
    if (!this._startTouchData) return this.touchstart(e);
    this._lastTouchEvent = e;
    this._lastTouchData = this._getTouchEventData(e);
    // TODO check time vs. start time to prevent responding to spurious events?
    return true; // signal to extended classes that they should continue processing the touchmove event
  }

  touchend(e: TouchEvent) {
    if (!e.touches || e.touches.length === 0) this.deactivate();
  }

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

class TouchPanHandler extends TouchHandler {

  // _pointsMatch(lastPoints: ?Array<Point>, thisPoints: ?Array<Point>) {
  //     if (!lastPoints || !thisPoints || lastPoints.length !== thisPoints.length) return false;
  //     return lastPoints.every((pos, i) => thisPoints[i] === pos);
  // }

  get _tapTolerance() {
    return 1;
  }

  touchmove(e: TouchEvent) {
    if (!super.touchmove(e)) return;

    // const noMovement = this._pointsMatch(this._lastTouchData.points, this._startTouchData.points);
    const underTapTolerance = this._lastTouchData.centerPoint.dist(this._startTouchData.centerPoint) < this._tapTolerance;

    //TODO track inertia

    const location = this._startTouchData.centerLocation;
    const point = this._lastTouchData.centerPoint;

    this._startTouchEvent = this._lastTouchEvent;
    this._startTouchData = this._lastTouchData;
    this._startTime = browser.now();

    if (underTapTolerance) return;
    this._state = 'active';
    return { transform: { setLocationAtPoint: [location, point] }};

  }

  touchend(e: TouchEvent) {
    const stateBeforeEnd = this._state;
    super.touchend(e);
    if (this._state === 'pending' || this._state === 'active') {
      // We did not deactivate, as there are still finger(s) touching.
      // Reset the start event for the remaining finger(s), as if on touchstart
      this._setStartTouch(e);
    }
  }

}

class MultiTouchHandler extends TouchHandler {

  touchstart(e: TouchEvent) {
    if (e.touches && e.touches.length > 1) super.touchstart(e);
  }

  touchmove(e: TouchEvent) {
    if (e.touches && e.touches.length > 1) return super.touchmove(e);
  }

  touchend(e: TouchEvent) {
    if (!e.touches || e.touches.length < 2) this.deactivate();
  }
}

class TouchZoomHandler extends MultiTouchHandler {

    get _threshold() {
      return this._state === 'active' ? 0 : 0.15;
    }

    touchmove(e: TouchEvent) {
      if (!super.touchmove(e)) return;

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

class TouchRotateHandler extends MultiTouchHandler {

    get _threshold() {
      return 0;
    }

    touchmove(e: TouchEvent) {
      if (!super.touchmove(e)) return;

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

class TouchPitchHandler extends MultiTouchHandler {
    _horizontalThreshold: number;

    constructor(el: HTMLElement, options?: Object) {
      super(el, options);
      this._horizontalThreshold = 50;
    }

    _pointsAreHorizontal(pointA, pointB) {
      return Math.abs(pointA.y - pointB.y) < this._horizontalThreshold;
    }

    touchmove(e: TouchEvent) {
      if (!super.touchmove(e)) return;

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
        return { transform: { pitchDelta }};
      } else {
        this._state = 'pending';
      }
    }
}


export { TouchHandler, TouchPanHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler };
