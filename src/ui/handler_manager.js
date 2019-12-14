// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import DOM from '../util/dom';
import type Map from './map';
import Handler from './handler/handler';
import { TouchZoomHandler, TouchRotateHandler, TouchPitchHandler } from './handler/touch';
import {extend} from '../util/util';


class HandlerManager {
  _map: Map;
  _el: HTMLElement;
  _handlers: Array<Handler>;

  /**
   * @private
   */
  constructor(map: Map, options?: Object) {
    this._map = map;
    this._el = this._map.getCanvasContainer();
    this._handlers = [];

    this._addDefaultHandlers();

    // Bind touchstart and touchmove with passive: false because, even though
    // they only fire a map events and therefore could theoretically be
    // passive, binding with passive: true causes iOS not to respect
    // e.preventDefault() in _other_ handlers, even if they are non-passive
    // (see https://bugs.webkit.org/show_bug.cgi?id=184251)
    this.addTouchListener('touchstart', {passive: false});
    this.addTouchListener('touchmove', {passive: false});
    this.addTouchListener('touchend');
    this.addTouchListener('touchcancel');

    this.addMouseListener('mousedown');
    this.addMouseListener('mouseup');
  }

  _addDefaultHandlers() {
    this.add('touchPitch', new TouchPitchHandler(this._map));
    this.add('touchZoom', new TouchZoomHandler(this._map));
    this.add('touchRotate', new TouchRotateHandler(this._map));
  }

  list() {
    return this._handlers.map(([name, handler]) => name);
  }

  get length() {
    return this._handlers.length;
  }

  add(handlerName: string, handler: Handler) {
    if (!handlerName || !(/^[a-z]+[a-zA-Z]*$/.test(handlerName))) throw new Error('Must provide a valid handlerName string');
    if (!handler || !(handler instanceof Handler)) throw new Error('Must provide a valid Handler instance');

    if (this[handlerName]) throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
    for (const [existingName, existingHandler] of this._handlers) {
      if (existingHandler === handler) throw new Error(`Cannot add ${handler} as ${handlerName}: handler already exists as ${existingName}`);
    }

    this._handlers.push([handlerName, handler]);
    this[handlerName] = handler;
  }

  remove(handlerName: string) {
    if (!handlerName || typeof handlerName !== 'string') throw new Error('Must provide a valid handlerName string');
    if (!this[handlerName]) throw new Error(`Handler ${handlerName} not found`);
    const newHandlers = this._handlers.filter(([existingName, existingHandler]) => {
      if (existingName === handlerName) {
        delete this[handlerName];
        return false;
      }
      return true;
    });
    this._handlers = newHandlers;
  }

  removeAll() {
    for (const [handlerName, _] of this._handlers) this.remove(handlerName);
  }


  addListener(mapEventClass: Event, eventType: string, options?: Object) {
    const listener = (e: Event) => {
      this._map.fire(new mapEventClass(eventType, this._map, e));
      this.processInputEvent(e);
    };
    DOM.addEventListener(this._el, eventType, listener, options);
  }

  addTouchListener(eventType: string, options?: Object) {
    this.addListener(MapTouchEvent, eventType, options);
  }

  addMouseListener(eventType: string, options?: Object) {
    this.addListener(MapMouseEvent, eventType, options);
  }


  processInputEvent(e: MouseEvent | TouchEvent | KeyboardEvent | WheelEvent) {
    if (e.cancelable) e.preventDefault();
    let newSettings = {};
    let mapMethods = {};

    for (const [name, handler] of this._handlers) {
      if (!handler.isEnabled()) continue;
      let data = handler.processInputEvent(e);
      if (!data) continue;
      // Check for disabledDuring relationships

      // validate the update request
      if (data.transform) extend(newSettings, data.transform);
    }
    // Set map transform accordingly
    if (newSettings.zoom || newSettings.bearing || newSettings.pitch || newSettings.setLocationAtPoint) {
      this.updateMapTransform(newSettings);
    }

    // Call map methods accordingly
    // };
  }

  updateMapTransform(newSettings) {
    const tr = this._map.transform;
    let { zoom, bearing, pitch, setLocationAtPoint } = newSettings;
    if (zoom) tr.zoom = zoom;
    if (bearing) tr.bearing = bearing;
    if (pitch) tr.pitch = pitch;
    if (setLocationAtPoint && setLocationAtPoint.length === 2) {
      let [loc, pt] = setLocationAtPoint;
      tr.setLocationAtPoint(loc, pt);
    }
    this._map._update()
  }
}


export default HandlerManager;
