// @flow

import Handler from './handler';
import Inertia from './inertia';
import DOM from '../../util/dom';
import window from '../../util/window';
import browser from '../../util/browser';
import { bindAll } from '../../util/util';

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

    bindAll([
        '_onTouchStart',
        '_onTouchMove',
        '_onTouchEnd',
        '_onTouchCancel'
    ], this);

    // Bind touchstart and touchmove with passive: false because, even though
    // they only fire a map events and therefore could theoretically be
    // passive, binding with passive: true causes iOS not to respect
    // e.preventDefault() in _other_ handlers, even if they are non-passive
    // (see https://bugs.webkit.org/show_bug.cgi?id=184251)
    DOM.addEventListener(this._el, 'touchstart', this._onTouchStart, {passive: false});
    DOM.addEventListener(this._el, 'touchmove', this._onTouchMove, {passive: false});
    DOM.addEventListener(this._el, 'touchend', this._onTouchEnd);
    DOM.addEventListener(this._el, 'touchcancel', this._onTouchCancel);

  }

  _getTouchEventData(e: TouchEvent) {
      const isMultiTouch = e.touches.length > 1;
      const points = e.touches.map(touch => DOM.mousePos(this._el, touch));
      const center = isMultiTouch ? points[0].add(points[1]).div(2) : points[0];
      const vector = isMultiTouch ? points[0].sub(points[1]) : null ;
      return { isMultiTouch, points, center, vector };
  }


  _onTouchStart(e: TouchEvent) {
    if (!this.isEnabled()) return;
    this._startTouchEvent = e;
    this._startTouchData = this._getTouchEventData(e);
    this._startTime = browser.now();
    // this._state = 'pending';
  };

  // _onTouchMove(e: TouchEvent) {
  //
  // }
  //
  // _onTouchEnd(e: TouchEvent) {
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

    _onTouchStart(e: TouchEvent) {
      super._onTouchStart(e);
      if (!this._startTouchData.isMultiTouch) return;
      this._state = 'pending';
      this._startScale = this._map.transform.scale;
    }

    _onTouchMove(e: TouchEvent) {
      console.log('TouchZoomHandler._onTouchMove');
      if (!(this._state === 'pending' || this._state === 'active')) return;
      this._lastTouchEvent = e;
      this._lastTouchData = this._getTouchEventData(e);
      if (!this._lastTouchData.isMultiTouch) return;
      // TODO check time vs. start time to prevent responding to spurious events (vs. tap)
      const scale = this._lastTouchData.vector.mag() / this._startTouchData.vector.mag();
      const scalingSignificantly = Math.abs(1 - scale) > this.significantScaleThreshold;
      if (scalingSignificantly) {
        this._state = 'active';
        // TODO request update
      }
    }
}


export { TouchHandler, TouchZoomHandler };
