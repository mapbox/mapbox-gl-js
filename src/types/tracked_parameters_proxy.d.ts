declare module 'tracked_parameters_proxy' {
  export type Description = any;

  export function registerParameter(
    containerObject: any,
    scope: Array<string>,
    name: string,
    description?: Description | null,
    changeValueCallback?: any | null
  ): void;

  export function registerButton(
    scope: Array<string>,
    buttonTitle: string,
    onClick: any
  ): void;

  export function registerBinding(
    containerObject: any,
    scope: Array<string>,
    name: string,
    description?: object,
  ): void;

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

  export class TrackedParameters implements ITrackedParameters {
      constructor(map: any);

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
}

export {};
