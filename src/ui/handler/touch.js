// @flow

import Handler from './handler';
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

  _start(e: TouchEvent) {
    if (!this.isEnabled()) return;
    this._setStartTouch(e);
    if (this._state !== 'active') this._state = 'pending';
  }

  reset(e: TouchEvent) {
    this._start(e);
    if (this._state === 'active') {
      this._state === 'pending';
    }
  }

  touchstart(e: TouchEvent) {
    this._start(e);
  }

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

  get _tapTolerance() {
    return 1;
  }

  touchmove(e: TouchEvent) {
    if (!super.touchmove(e)) return;

    const underTapTolerance = this._lastTouchData.centerPoint.dist(this._startTouchData.centerPoint) < this._tapTolerance;
    if (underTapTolerance) return;

    const location = this._startTouchData.centerLocation;
    const point = this._lastTouchData.centerPoint;

    const events = [];
    if (this._state === 'pending') events.push('dragstart');
    this._state = 'active';
    events.push('drag');
    return { transform: { setLocationAtPoint: [location, point] }, events };

  }

  touchend(e: TouchEvent) {
    const stateBeforeEnd = this._state;
    super.touchend(e);
    if (this._state === 'pending' || this._state === 'active') {
      // We did not deactivate, as there are still finger(s) touching.
      // Reset the start event for the remaining finger(s), as if on touchstart
      this._setStartTouch(e);
    } else if (stateBeforeEnd === 'active') {
      return { events: ['dragend'] };
    }
  }

  touchcancel(e: TouchEvent) {
    const stateBeforeCancel = this._state;
    super.touchcancel(e);
    if (stateBeforeCancel === 'active') return { events: ['dragend']};
  }

  reset(e: TouchEvent) {
    const stateBeforeReset = this._state;
    super.reset(e);
    if (stateBeforeReset === 'active') return { events: ['dragend']};
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

  get _horizontalThreshold() { return 70; }
  get _shoveThreshold() {
    if (this._state === 'active') return 0;
    return 5;
  }

  _pointsAreHorizontal(pointA, pointB) {
    return Math.abs(pointA.y - pointB.y) < this._horizontalThreshold;
  }

  _shoveDetected() {
    const isHorizontal = this._pointsAreHorizontal(this._lastTouchData.points[0], this._lastTouchData.points[1]);
    const isMovingVertically = Math.abs(this._startTouchData.centerPoint.y - this._lastTouchData.centerPoint.y) > this._shoveThreshold;
    return isHorizontal && isMovingVertically;
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
        const events = [];
        if (this._state === 'pending') events.push('zoomstart');
        this._state = 'active';
        const zoomDelta = this._transform.scaleZoom(scale);
        this._startTouchEvent = this._lastTouchEvent;
        this._startTouchData = this._lastTouchData;
        this._startTime = browser.now();
        events.push('zoom');
        return { transform: { zoomDelta }, events };
      }
    }

    touchend(e: TouchEvent) {
      const stateBeforeEnd = this._state;
      super.touchend(e);
      if (stateBeforeEnd === 'active') return { events: ['zoomend'] };
    }

    touchcancel(e: TouchEvent) {
      const stateBeforeCancel = this._state;
      super.touchcancel(e);
      if (stateBeforeCancel === 'active') return { events: ['zoomend']};
    }

    reset(e: TouchEvent) {
      const stateBeforeReset = this._state;
      super.reset(e);
      if (stateBeforeReset === 'active') return { events: ['zoomend']};
    }
}

class TouchRotateHandler extends MultiTouchHandler {

    get _rotationThreshold() {
      if (this._state === 'active') return 0;
      return 2;
    }

    touchmove(e: TouchEvent) {
      if (!super.touchmove(e)) return;

      const isVerticalShove = this._shoveDetected();
      const bearingDelta = this._lastTouchData.vector.angleWith(this._startTouchData.vector) * 180 / Math.PI

      this._startTouchEvent = this._lastTouchEvent;
      this._startTouchData = this._lastTouchData;
      this._startTime = browser.now();

      if (!isVerticalShove && Math.abs(bearingDelta) > this._rotationThreshold) {
        const events = [];
        if (this._state === 'pending') events.push('rotatestart');
        this._state = 'active';
        events.push('rotate');
        return { transform: { bearingDelta }, events };
      }
    }

    touchend(e: TouchEvent) {
      const stateBeforeEnd = this._state;
      super.touchend(e);
      if (stateBeforeEnd === 'active') return { events: ['rotateend'] };
    }

    touchcancel(e: TouchEvent) {
      const stateBeforeCancel = this._state;
      super.touchcancel(e);
      if (stateBeforeCancel === 'active') return { events: ['rotateend']};
    }

    reset(e: TouchEvent) {
      const stateBeforeReset = this._state;
      super.reset(e);
      if (stateBeforeReset === 'active') return { events: ['rotateend']};
    }
}

class TouchPitchHandler extends MultiTouchHandler {

    touchmove(e: TouchEvent) {
      if (!super.touchmove(e)) return;

      // const isHorizontal = this._pointsAreHorizontal(this._lastTouchData.points[0], this._lastTouchData.points[1]);
      const isVerticalShove = this._shoveDetected();
      const pitchDelta = (this._startTouchData.centerPoint.y - this._lastTouchData.centerPoint.y) * 0.4;

      this._startTouchEvent = this._lastTouchEvent;
      this._startTouchData = this._lastTouchData;
      this._startTime = browser.now();

      if (isVerticalShove && Math.abs(pitchDelta) > 0) {
        const events = [];
        if (this._state === 'pending') events.push('pitchstart');
        this._state = 'active';
        events.push('pitch');
        return { transform: { pitchDelta }, events };
      }
    }

    touchend(e: TouchEvent) {
      const stateBeforeEnd = this._state;
      super.touchend(e);
      if (stateBeforeEnd === 'active') return { events: ['pitchend'] };
    }

    touchcancel(e: TouchEvent) {
      const stateBeforeCancel = this._state;
      super.touchcancel(e);
      if (stateBeforeCancel === 'active') return { events: ['pitchend']};
    }

    reset(e: TouchEvent) {
      const stateBeforeReset = this._state;
      super.reset(e);
      if (stateBeforeReset === 'active') return { events: ['pitchend']};
    }
}


export { TouchHandler, TouchPanHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler };
