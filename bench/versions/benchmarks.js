import mapboxgl from '../../src/index.js';
import accessToken from '../lib/access_token.js';
import locationsWithTileID from '../lib/locations_with_tile_id.js';
import styleBenchmarkLocations from '@mapbox/gazetteer/benchmark/style-benchmark-locations.json';
import Layout from '../benchmarks/layout.js';
import Placement from '../benchmarks/placement.js';
import LayoutDDS from '../benchmarks/layout_dds.js';
import SymbolLayout from '../benchmarks/symbol_layout.js';
import WorkerTransfer from '../benchmarks/worker_transfer.js';
import Paint from '../benchmarks/paint.js';
import PaintStates from '../benchmarks/paint_states.js';
import {PropertyLevelRemove, FeatureLevelRemove, SourceLevelRemove} from '../benchmarks/remove_paint_state.js';
import {LayerBackground, LayerCircle, LayerFill, LayerFillExtrusion, LayerHeatmap, LayerHillshade, LayerLine, LayerRaster, LayerSymbol, LayerSymbolWithIcons, LayerTextWithVariableAnchor, LayerSymbolWithSortKey} from '../benchmarks/layers.js';
import Load from '../benchmarks/map_load.js';
import HillshadeLoad from '../benchmarks/hillshade_load.js';
import Validate from '../benchmarks/style_validate.js';
import StyleLayerCreate from '../benchmarks/style_layer_create.js';
import QueryPoint from '../benchmarks/query_point.js';
import QueryBox from '../benchmarks/query_box.js';
import {FunctionCreate, FunctionEvaluate, ExpressionCreate, ExpressionEvaluate} from '../benchmarks/expressions.js';
import FilterCreate from '../benchmarks/filter_create.js';
import FilterEvaluate from '../benchmarks/filter_evaluate.js';

import getWorkerPool from '../../src/util/global_worker_pool.js';

const styleLocations = locationsWithTileID(styleBenchmarkLocations.features);

mapboxgl.accessToken = accessToken;

window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;

function register(name, bench) {
    window.mapboxglBenchmarks[name] = window.mapboxglBenchmarks[name] || {};
    window.mapboxglBenchmarks[name][version] = bench;
}

const style = 'mapbox://styles/mapbox/streets-v10';
const center = [-77.032194, 38.912753];
const zooms = [4, 8, 11, 13, 15, 17];
const locations = zooms.map(zoom => ({center, zoom}));

register('Paint', new Paint(style, locations));
register('QueryPoint', new QueryPoint(style, locations));
register('QueryBox', new QueryBox(style, locations));
register('Layout', new Layout(style));
register('Placement', new Placement(style, locations));
register('Validate', new Validate(style));
register('StyleLayerCreate', new StyleLayerCreate(style));
register('FunctionCreate', new FunctionCreate(style));
register('FunctionEvaluate', new FunctionEvaluate(style));
register('ExpressionCreate', new ExpressionCreate(style));
register('ExpressionEvaluate', new ExpressionEvaluate(style));
register('WorkerTransfer', new WorkerTransfer(style));
register('PaintStates', new PaintStates(center));
register('PropertyLevelRemove', new PropertyLevelRemove(center));
register('FeatureLevelRemove', new FeatureLevelRemove(center));
register('SourceLevelRemove', new SourceLevelRemove(center));
register('LayerBackground', new LayerBackground());
register('LayerCircle', new LayerCircle());
register('LayerFill', new LayerFill());
register('LayerFillExtrusion', new LayerFillExtrusion());
register('LayerHeatmap', new LayerHeatmap());
register('LayerHillshade', new LayerHillshade());
register('LayerLine', new LayerLine());
register('LayerRaster', new LayerRaster());
register('LayerSymbol', new LayerSymbol());
register('LayerSymbolWithIcons', new LayerSymbolWithIcons());
register('LayerTextWithVariableAnchor', new LayerTextWithVariableAnchor());
register('LayerSymbolWithSortKey', new LayerSymbolWithSortKey());
register('Load', new Load());
register('LayoutDDS', new LayoutDDS());
register('SymbolLayout', new SymbolLayout(style, styleLocations.map(location => location.tileID[0])));
register('FilterCreate', new FilterCreate());
register('FilterEvaluate', new FilterEvaluate());
register('HillshadeLoad', new HillshadeLoad());

Promise.resolve().then(() => {
    // Ensure the global worker pool is never drained. Browsers have resource limits
    // on the max number of workers that can be created per page.
    // We do this async to avoid creating workers before the worker bundle blob
    // URL has been set up, which happens after this module is executed.
    getWorkerPool().acquire(-1);
});

export default mapboxgl;
