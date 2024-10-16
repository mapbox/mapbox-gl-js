
import {createExpression} from '../style-spec/expression/index';
import {getNameFromFQID, getScopeFromFQID} from '../util/fqid';
import {Event} from '../util/evented';

import type {MapEvents, MapMouseEventType, MapMouseEvent} from './events';
import type {Map as MapboxMap} from './map';
import type {FeaturesetDescriptor} from '../style/style';
import type {GeoJSONFeature} from '../util/vectortile_to_geojson';
import type {ExpressionSpecification} from '../style-spec/types';
import type {StyleExpression, Feature} from '../style-spec/expression/index';
import type LngLat from '../geo/lng_lat';
import type Point from '@mapbox/point-geometry';

export type Interaction = {
    type: MapMouseEventType;
    filter?: ExpressionSpecification;
    featuresetId?: FeaturesetDescriptor;
    handler: (event: InteractionEvent) => boolean;
};

export class InteractionEvent extends Event<MapEvents, MapMouseEventType> {
    override type: MapMouseEventType;
    override target: MapboxMap;
    originalEvent: MouseEvent;
    point: Point;
    lngLat: LngLat;
    preventDefault: () => void;

    id: string;
    interaction: Interaction;
    feature?: GeoJSONFeature;

    constructor(e: MapMouseEvent, id: string, interaction: Interaction, feature?: GeoJSONFeature) {
        const {point, lngLat, originalEvent, target} = e;
        super(e.type, {point, lngLat, originalEvent, target} as MapEvents[MapMouseEventType]);
        this.preventDefault = () => { e.preventDefault(); };

        this.id = id;
        this.interaction = interaction;
        this.feature = feature;
    }
}

export class InteractionSet {
    map: MapboxMap;
    interactionsByType: Map<MapMouseEventType, Map<string, Interaction>>;
    typeById: Map<string, MapMouseEventType>;
    filters: Map<string, StyleExpression>;

    constructor(map) {
        this.map = map;
        this.interactionsByType = new Map(); // sort interactions into type buckets for fast handling
        this.typeById = new Map(); // keep track of each id type for easy removal
        this.filters = new Map(); // cache compiled filter expressions for each interaction

        this.handleType = this.handleType.bind(this);
    }

    add(id: string, interaction: Interaction) {
        if (this.typeById.has(id)) {
            throw new Error(`Interaction id "${id}" already exists.`);
        }
        const {type, filter} = interaction;

        if (filter) {
            const compiled = createExpression(filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false});
            if (compiled.result === 'error')
                throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));

            this.filters.set(id, compiled.value);
        }

        const interactions = this.interactionsByType.get(type) || new Map();

        // if we didn't have an interaction of this type before, add a map listener for it
        if (interactions.size === 0) {
            this.map.on(type, this.handleType);
            this.interactionsByType.set(type, interactions);
        }

        interactions.set(id, interaction);
        this.typeById.set(id, type);
    }

    remove(id: string) {
        const type = this.typeById.get(id);
        if (!type) return;

        this.typeById.delete(id);
        this.filters.delete(id);

        const interactions = this.interactionsByType.get(type);
        if (!interactions) return;

        interactions.delete(id);

        // if there are no more interactions of this type, remove the map listener
        if (interactions.size === 0) {
            this.map.off(type, this.handleType);
        }
    }

    handleType(event: MapMouseEvent) {
        // only query features once for every interaction type
        const features = event.features || this.map.queryRenderedFeatures(event.point);
        if (!features) return;

        const interactions = this.interactionsByType.get(event.type);
        const ctx = {zoom: 0};

        for (const [id, interaction] of interactions) {
            const filter = this.filters.get(id);
            const {handler, featuresetId} = interaction;
            let handled = false;

            for (const feature of features) {
                // narrow down features through filter and layers
                if (featuresetId) {
                    const targetLayerId = feature.layer.id;
                    const targetLayerName = getNameFromFQID(targetLayerId);
                    const targetLayerScope = getScopeFromFQID(targetLayerId);
                    if (!(typeof featuresetId === 'string' ? featuresetId === targetLayerId :
                        featuresetId.id === targetLayerName && featuresetId.importId === targetLayerScope)) continue;
                }
                if (filter && !filter.evaluate(ctx, feature as unknown as Feature)) continue;

                // if we explicitly returned false in a feature handler, pass through to the feature below it
                const stop = handler(new InteractionEvent(event, id, interaction, feature));
                if (stop !== false) {
                    handled = true;
                    break;
                }
            }
            if (!handled) {
                // if no features handled the interactions, propagate to map
                handler(new InteractionEvent(event, id, interaction, null));
            }
        }
    }
}
