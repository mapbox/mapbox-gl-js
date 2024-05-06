// @flow

import type {ITrackedParameters} from 'tracked_parameters_proxy';

// Parameter description
// * Description from TweakPane
// * extended options:
//   * noSave - do not save/load the parameter value between page reloads
export type Description = Object | { noSave: boolean };

export function registerParameter(_containerObject: Object, _scope: Array<string>, _name: string, _description: ?Description, _changeValueCallback: ?Function) {
}

export function registerButton(_scope: Array<string>, _buttonTitle: string, _onClick: Function) {
}

export function registerBinding(_containerObject: Object, _scope: Array<string>, _name: string, _description: ?Object) {
}

export function refreshUI() {}

export class TrackedParameters implements ITrackedParameters {
    registerParameter(_containerObject: Object, _scope: Array<string>, _name: string, _description: ?Description, _changeValueCallback: ?Function) { }
    registerButton(_scope: Array<string>, _buttonTitle: string, _onClick: Function) { }
    registerBinding(_containerObject: Object, _scope: Array<string>, _name: string, _description: ?Object) { }
    refreshUI() { }
}
