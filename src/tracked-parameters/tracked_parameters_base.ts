import {Debug} from '../util/debug';
import {warnOnce} from '../util/util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Description = any;

export interface ITrackedParameters {
  registerParameter: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    containerObject: any,
    scope: Array<string>,
    name: string,
    description?: Description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changeValueCallback?: any
  ) => void;

  registerButton: (
    scope: Array<string>,
    buttonTitle: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick: any
  ) => void;

  registerBinding: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    containerObject: any,
    scope: Array<string>,
    name: string,
    description?: object,
  ) => void;

  refreshUI: () => void;
}

// For fast prototyping in case of only one map present
let global: ITrackedParameters | null | undefined;

export function setGlobal(tp: ITrackedParameters) {
    global = tp;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerParameter(object: any, scope: Array<string>, name: string, description: Description, onChange: any) {
    Debug.run(() => {
        if (global) {
            global.registerParameter(object, scope, name, description, onChange);

            console.warn(`Dev only "registerParameter('${name}')" call. For production consider replacing with tracked parameters container method.`);
        }
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerButton(scope: Array<string>, buttonTitle: string, onClick: any) {
    Debug.run(() => {
        if (global) {
            global.registerButton(scope, buttonTitle, onClick);

            console.warn(`Dev only "registerButton('${buttonTitle}')" call. For production consider replacing with tracked parameters container method.`);
        }
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerBinding(containerObject: any, scope: Array<string>, name: string, description?: Description) {
    Debug.run(() => {
        if (global) {
            global.registerBinding(containerObject, scope, name, description);

            console.warn(`Dev only "registerBinding('${name}')" call. For production consider replacing with tracked parameters container method.`);
        }
    });
}

export function refreshUI() {
    Debug.run(() => {
        if (global) {
            global.refreshUI();

            warnOnce(`Dev only "refreshUI" call. For production consider replacing with tracked parameters container method.`);
        }
    });
}

export class TrackedParametersMock implements ITrackedParameters {
    registerParameter() {}

    registerButton() {}

    registerBinding() {}

    refreshUI() {}
}
