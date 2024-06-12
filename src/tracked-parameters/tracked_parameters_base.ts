import {Debug} from '../util/debug';
import {warnOnce} from '../util/util';

export type Description = any;

export interface ITrackedParameters {
  registerParameter(
    containerObject: any,
    scope: Array<string>,
    name: string,
    description?: Description | null,
    changeValueCallback?: any | null
  ): void;

  registerButton(
    scope: Array<string>,
    buttonTitle: string,
    onClick: any
  ): void;

  registerBinding(
    containerObject: any,
    scope: Array<string>,
    name: string,
    description?: object,
  ): void;

  refreshUI(): void;
}

// For fast prototyping in case of only one map present
let global: ITrackedParameters | null | undefined;

export function setGlobal(tp: ITrackedParameters) {
    global = tp;
}

export function registerParameter(object: any, scope: Array<string>, name: string, description: Description | null | undefined, onChange: any) {
    Debug.run(() => {
        if (global) {
            global.registerParameter(object, scope, name, description, onChange);

            console.warn(`Dev only "registerParameter('${name}')" call. For production consider replacing with tracked parameters container method.`);
        }
    });
}

export function registerButton(scope: Array<string>, buttonTitle: string, onClick: any) {
    Debug.run(() => {
        if (global) {
            global.registerButton(scope, buttonTitle, onClick);

            console.warn(`Dev only "registerButton('${buttonTitle}')" call. For production consider replacing with tracked parameters container method.`);
        }
    });
}

export function registerBinding(containerObject: any, scope: Array<string>, name: string, description?: any | null) {
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
