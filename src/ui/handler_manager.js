// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import {Event} from '../util/evented';
import DOM from '../util/dom';
import type Map from './map';
import Handler from './handler/handler';
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
    this._disableDuring = {};

    // Track whether map is currently moving, to compute start/move/end events
    this._eventsInProgress = {
      zoom: false,
      rotate: false,
      pitch: false,
      drag: false
    };


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
    this.addMouseListener('mousemove');
    this.addMouseListener('mouseup');
    this.addMouseListener('mouseover');
    this.addMouseListener('mouseout');
  }

  list() {
    return this._handlers.map(([name, handler]) => name);
  }

  get length() {
    return this._handlers.length;
  }

  add(handlerName: string, handler: Handler, disableDuring: Array<string>) {
    if (!handlerName || !(/^[a-z]+[a-zA-Z]*$/.test(handlerName))) throw new Error('Must provide a valid handlerName string');
    if (!handler || !(handler instanceof Handler)) throw new Error('Must provide a valid Handler instance');

    if (this[handlerName]) throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
    for (const [existingName, existingHandler] of this._handlers) {
      if (existingHandler === handler) throw new Error(`Cannot add ${handler} as ${handlerName}: handler already exists as ${existingName}`);
    }
    this._handlers.push([handlerName, handler]);
    this[handlerName] = handler;

    if (disableDuring) {
      for (const otherHandler of disableDuring) {
        if (!this[otherHandler]) throw new Error(`Cannot disable ${handlerName} during ${otherHandler}: No such handler ${otherHandler}`);
      }
      this._disableDuring[handlerName] = disableDuring;
    }
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

  disableAll() {
    for (const [_, handler] of this._handlers) handler.disable();
  }

  enableAll() {
    for (const [_, handler] of this._handlers) handler.enable();
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
    let transformSettings;
    let activeHandlers = [];
    let preUpdateEvents = [];
    let postUpdateEvents = [];

    for (const [name, handler] of this._handlers) {
      if (!handler.isEnabled()) continue;
      let data = handler.processInputEvent(e);
      if (!data) continue;

      if (this._disableDuring[name]) {
        const conflicts = this._disableDuring[name].filter(otherHandler => activeHandlers.indexOf(otherHandler) > -1);
        if (conflicts.length > 0) {
          // A handler that was active but is now overridden should still be able to return end events to fire
          if (data.events) {
            data.events.filter(e => e.endsWith('end') && postUpdateEvents.indexOf(e) < 0).map(e => postUpdateEvents.push(e));
          }
          handler.reset(e);
          continue;
        }
      }

      if (data.transform) {
        const merged = data.transform
        if (!!transformSettings) extend(merged, transformSettings)
        transformSettings = merged;
      }

      if (data.events) {
        for (const event of data.events) {
          if (event.endsWith('start')) {
            if (preUpdateEvents.indexOf(event) < 0) preUpdateEvents.push(event);
          } else if (postUpdateEvents.indexOf(event) < 0) {
            postUpdateEvents.push(event);
          }
        }
      }
      activeHandlers.push(name);
    }

    if (preUpdateEvents.length > 0) this.fireMapEvents(preUpdateEvents, e); // movestart events
    if (transformSettings) this.updateMapTransform(transformSettings);
    if (postUpdateEvents.length > 0) this.fireMapEvents(postUpdateEvents, e); // move and moveend events
  }

  updateMapTransform(settings) {
    const tr = this._map.transform;
    let { zoomDelta, bearingDelta, pitchDelta, setLocationAtPoint } = settings;
    if (zoomDelta) tr.zoom += zoomDelta;
    if (bearingDelta) tr.bearing += bearingDelta;
    if (pitchDelta) tr.pitch += pitchDelta;
    if (setLocationAtPoint && setLocationAtPoint.length === 2) {
      let [loc, pt] = setLocationAtPoint;
      tr.setLocationAtPoint(loc, pt);
    }
    this._map._update();
  }

  get _moving() {
    for (const e of ['zoom', 'rotate', 'pitch', 'drag']) { if (this._eventsInProgress[e]) return true; }
    return false;
  }

  fireMapEvents(events, originalEvent) {
    const alreadyMoving = this._moving;
    const moveEvents = [];
    for (const event of events) {
      const eventType = event.replace('start', '').replace('end', '');
      if (event.endsWith('start')) {
        if (this._eventsInProgress[eventType]) { continue; } // spurious start event, don't fire
        else { this._eventsInProgress[eventType] = true; }
        if (!alreadyMoving && moveEvents.indexOf('movestart') < 0) { moveEvents.push('movestart'); }

      } else if (event.endsWith('end')) {
        if (!this._eventsInProgress[eventType]) { continue; } // spurious end event, don't fire
        else { this._eventsInProgress[eventType] = false; }
        if (!this._moving && moveEvents.indexOf('moveend') < 0) { moveEvents.push('moveend'); }

      } else {
        if (!this._eventsInProgress[eventType]) {
          // We never got a corresponding start event for some reason; fire it now & update event progress state
          this._map.fire(new Event(eventType + 'start', { originalEvent }));
          if (!alreadyMoving) {
            this._map.fire(new Event('movestart', { originalEvent }));
            alreadyMoving = true;
          }
          this._eventsInProgress[eventType] = true;
        }
        if (moveEvents.indexOf('move') < 0) { moveEvents.push('move'); }
      }

      this._map.fire(new Event(event, { originalEvent }));
    }
    for (const moveEvent of moveEvents) this._map.fire(new Event(moveEvent, { originalEvent }));
  }
}


export default HandlerManager;
