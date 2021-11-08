// @flow

export type Anchor =
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';

export const anchorTranslate: {[_: Anchor]: string} = {
    'center': 'translate(-50%,-50%)',
    'top': 'translate(-50%,0)',
    'top-left': 'translate(0,0)',
    'top-right': 'translate(-100%,0)',
    'bottom': 'translate(-50%,-100%)',
    'bottom-left': 'translate(0,-100%)',
    'bottom-right': 'translate(-100%,-100%)',
    'left': 'translate(0,-50%)',
    'right': 'translate(-100%,-50%)'
};
