import type {ITrackedParameters} from 'tracked_parameters_proxy';

// Parameter description
// * Description from TweakPane
// * extended options:
//   * noSave - do not save/load the parameter value between page reloads
export type Description = any | {
    noSave: boolean;
};

export function registerParameter(_containerObject: any, _scope: Array<string>, _name: string, _description?: Description | null, _changeValueCallback?: any | null) {
}

export function registerButton(_scope: Array<string>, _buttonTitle: string, _onClick: any) {
}

export function registerBinding(_containerObject: any, _scope: Array<string>, _name: string, _description?: any | null) {
}

export function refreshUI() {}

export class TrackedParameters implements ITrackedParameters {
    registerParameter(_containerObject: any, _scope: Array<string>, _name: string, _description?: Description | null, _changeValueCallback?: any | null) { }
    registerButton(_scope: Array<string>, _buttonTitle: string, _onClick: any) { }
    registerBinding(_containerObject: any, _scope: Array<string>, _name: string, _description?: any | null) { }
    refreshUI() { }
}
