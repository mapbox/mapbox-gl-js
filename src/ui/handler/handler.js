// @flow

import type Map from './map';

/**
 * Base class for gesture handlers which control user interaction with the map
 */
class Handler {
  _state: 'disabled' | 'enabled' | 'pending' | 'active';
  _options: Object;
  _map: Map;

  constructor(map: Map, options: ?Object) {
    this._map = map;
    this._options = {};
    if (options) this.setOptions(options);
    this._state = 'enabled';
  }

  /**
   * Returns a Boolean indicating whether this handler's interaction is enabled.
   *
   * @returns {boolean} `true` if the interaction is enabled.
   */
  isEnabled() {
      return this._state !== 'disabled';
  }


  /**
   * Enables this handler's interaction.
   *
   */
  enable() {
      if (this.isEnabled()) return;
      this._state = 'enabled';
  }

  /**
   * Disables this handler's interaction.
   *
   */
  disable() {
      if (!this.isEnabled()) return;
      this._state = 'disabled';
  }

  /**
   * Set custom options for this handler.
   *
   * @param {Object} [options] Object in { option: value } format.
   */
  setOptions(options: any) {
    if (!options) throw new Error('Must provide a valid options object');
    let unrecognized = [];
    for (const property in options) {
      if (this._options[property] === undefined) unrecognized.push(property);
      else this._options[property] = options[property];
    }
    if (unrecognized.length > 0) throw new Error(`Unrecognized option${unrecognized.length > 1 ? 's' : ''}: ${unrecognized.join(', ')}`);
  }

  /**
   * Get the current options for this handler.
   *
   * @returns {Object} Options object in { option: value } format.
   */
  getOptions() {
    return this._options;
  }
}

export default Handler;
