// @flow

import Handler from './handler';
import DOM from '../../util/dom';

import Inertia from './inertia';

import type Map from '../map';
import type Point from '@mapbox/point-geometry';


class TouchHandler extends Handler {
  _el: HTMLElement;
  _startTouchEvent: ?TouchEvent;
  _startTime: ?number;

  /**
   * @private
   */
  constructor(map: Map, options: ?Object) {
    super(map, options);
    this._el = this.map.getCanvasContainer();

    // Bind touchstart and touchmove with passive: false because, even though
    // they only fire a map events and therefore could theoretically be
    // passive, binding with passive: true causes iOS not to respect
    // e.preventDefault() in _other_ handlers, even if they are non-passive
    // (see https://bugs.webkit.org/show_bug.cgi?id=184251)
    DOM.addEventListener(el, 'touchstart', this._onTouchStart, {passive: false});
    DOM.addEventListener(el, 'touchmove', this._onTouchMove, {passive: false});
    DOM.addEventListener(el, 'touchend', this._onTouchEnd);
    DOM.addEventListener(el, 'touchcancel', this._onTouchCancel);

  }

  _getTouchEventData(e: TouchEvent) {
      const multiTouch = e.touches.length > 1;
      const points = e.touches.map(touch => DOM.mousePos(this._el, touch));
      const vec = multiTouch ? points[0].sub(points[1]) : null ;

      return { multiTouch, points, vec };
  }


  _onTouchStart(e: TouchEvent) {
    if (!this.isEnabled()) return;
    this._startTouchEvent = e;
    this._startTime = browser.now();
    this._state = 'pending';
  };


}


export default TouchHandler;
