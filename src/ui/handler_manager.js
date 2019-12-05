// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import DOM from '../util/dom';
import type Map from './map';
import Handler from './handler';

class HandlerManager {
  _handlers: Array<Handler>;

  /**
   * @private
   */
  constructor(map: Map, options: Object) {
    this._handlers = [];
  }

  list() {
    return this._handlers.map(([name, handler]) => name);
  }

  *[Symbol.iterator] () {
    for (const [name, handler] of this._handlers) {
      yield handler;
    }
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

}

export default HandlerManager;
