
import {createExpression} from '../style-spec/expression/index';
import {getNameFromFQID, getScopeFromFQID} from '../util/fqid';
import {Event} from '../util/evented';

import type {MapEvents, MapMouseEventType, MapMouseEvent} from './events';
import type {Map as MapboxMap} from './map';
import type {GeoJSONFeature, FeaturesetDescriptor} from '../util/vectortile_to_geojson';
import type {ExpressionSpecification} from '../style-spec/types';
import type {StyleExpression, Feature} from '../style-spec/expression/index';
import type LngLat from '../geo/lng_lat';
import type Point from '@mapbox/point-geometry';

export type Interaction = {
    type: MapMouseEventType;
    filter?: ExpressionSpecification;
    namespace?: string;
    featureset?: FeaturesetDescriptor;
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
        // The interactions are handled in reverse order of addition,
        // so that the last added interaction to the same target handles it first.
        const reversedInteractions = Array.from(interactions).reverse();
        const ctx = {zoom: 0};

        let handled = false;

        for (const feature of features) {
            for (const [id, interaction] of reversedInteractions) {
                const {handler, featureset} = interaction;
                if (!featureset) {
                    continue;
                }
                const filter = this.filters.get(id);

                // narrow down features through filter and layers
                const targetLayerId = feature.layer.id;
                const targetLayerName = getNameFromFQID(targetLayerId);
                const targetLayerScope = getScopeFromFQID(targetLayerId);

                if ('layerId' in featureset && featureset.layerId !== targetLayerId) {
                    continue;
                }

                if ('featuresetId' in featureset) {
                    if (featureset.importId !== targetLayerScope) continue;

                    const featuresetSpec = this.map.style.getFeatureset(featureset.featuresetId, featureset.importId);
                    if (!featuresetSpec || !featuresetSpec.selectors) continue;

                    const selectorLayers = featuresetSpec.selectors.map(selector => selector.layer);
                    if (!selectorLayers.includes(targetLayerName)) continue;
                }

                if (filter && !filter.evaluate(ctx, feature as unknown as Feature)) continue;

                // make a derived feature by cloning original feature
                // and replacing the layer property with the featureset
                const derivedFeature = feature.clone();
                delete derivedFeature.layer;
                derivedFeature.namespace = feature.namespace;
                derivedFeature.featureset = featureset;
                derivedFeature.properties = feature.properties;

                // if we explicitly returned false in a feature handler, pass through to the feature below it
                const stop = handler(new InteractionEvent(event, id, interaction, derivedFeature));
                if (stop !== false) {
                    handled = true;
                    break;
                }
            }
            if (handled) {
                break;
            }
        }

        if (handled) {
            return;
        }

        // If no interactions targeted to a featureset handled it, the targetless intaractions have chance to handle.
        for (const [id, interaction] of reversedInteractions) {
            const {handler, featureset} = interaction;
            if (featureset) {
                continue;
            }
            const stop = handler(new InteractionEvent(event, id, interaction, null));
            if (stop !== false) {
                break;
            }
        }
    }
}
