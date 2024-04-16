// @flow

export interface ITrackedParameters {
      registerParameter(_containerObject: any, _scope: Array<string>, _name: string, _description?: Description | null, _changeValueCallback?: any | null): void;
      registerButton(_scope: Array<string>, _buttonTitle: string, _onClick: any): void;
  }

export type Description = any;
