import {camera as cameraTool} from './camera';
import {feature as featureTool} from './feature';
import {layer as layerTool} from './layer';
import {marker as markerTool} from './marker';
import {popup as popupTool} from './popup';
import {source as sourceTool} from './source';
import {style as styleTool} from './style';

import type {MapboxWebMCPTool} from '../index';
import type {ObjectSchema} from '../schema';

function counted<S extends ObjectSchema>(name: string, tool: MapboxWebMCPTool<S>): MapboxWebMCPTool<S> {
    return {...tool, [Symbol.for('mapbox-webmcp.counter')]: name};
}

export const camera = /*#__PURE__*/ counted('camera', cameraTool);
export const feature = /*#__PURE__*/ counted('feature', featureTool);
export const layer = /*#__PURE__*/ counted('layer', layerTool);
export const marker = /*#__PURE__*/ counted('marker', markerTool);
export const popup = /*#__PURE__*/ counted('popup', popupTool);
export const source = /*#__PURE__*/ counted('source', sourceTool);
export const style = /*#__PURE__*/ counted('style', styleTool);

export const tools = {camera, source, layer, feature, style, marker, popup};
