
import {createExpression} from '../style-spec/expression/index';

import type {MapMouseEventType, MapMouseEvent} from './events';
import type {Map as MapboxMap} from './map';
import type {GeoJSONFeature} from '../util/vectortile_to_geojson';
import type {ExpressionSpecification} from '../style-spec/types';
import type {StyleExpression, Feature} from '../style-spec/expression/index';

type InteractionEvent = {
    id: string;
    interaction: Interaction;
    feature: GeoJSONFeature;
};

export type Interaction = {
    type: MapMouseEventType;
    filter?: ExpressionSpecification;
    layers?: string[];
    handler: (event: InteractionEvent) => boolean;
};

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
            const {handler, layers} = interaction;

            for (const feature of features) {
                // narrow down features through filter and layers
                if (layers && !layers.includes(feature.layer.id)) continue;
                if (filter && !filter.evaluate(ctx, feature as unknown as Feature)) continue;

                // if we explicitly returned false in a feature handler, pass through to the feature below it
                const stop = handler({id, feature, interaction});
                if (stop !== false) break;
            }
        }
    }
}
