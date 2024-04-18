// @flow

declare module 'tracked_parameters_proxy' {
    declare type Description = any;

    declare function registerParameter(
        containerObject: any,
        scope: Array<string>,
        name: string,
        description?: Description | null,
        changeValueCallback?: any | null
    ): void;

    declare function registerButton(
        scope: Array<string>,
        buttonTitle: string,
        onClick: any
    ): void;

    declare interface ITrackedParameters {
        constructor(map: any): void;

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
    }

    declare class TrackedParameters implements ITrackedParameters {
        constructor(map: any): void;

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
    }
}
