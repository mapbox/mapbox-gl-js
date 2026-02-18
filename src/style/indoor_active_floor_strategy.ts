import type {IndoorBuilding} from './indoor_data';

export class IndoorActiveFloorStrategy {
    static calculate(
        buildings: Record<string, IndoorBuilding>,
        selectedFloorId: string | null,
        lastActiveFloors: Set<string> | null
    ): Set<string> {
        const newActiveFloors = new Set<string>();
        const floorIdToConflicts = new Map<string, Set<string>>();
        const allFloors = new Set<string>();
        const allDefaultFloors = new Set<string>();

        // Build graph from all loaded buildings
        for (const building of Object.values(buildings)) {
            for (const [floorId, floor] of Object.entries(building.floors)) {
                allFloors.add(floorId);
                if (floor.isDefault) allDefaultFloors.add(floorId);
                if (floor.conflicts) floorIdToConflicts.set(floorId, floor.conflicts);

                // Add selected floor and its connections
                const isSelected = (floorId === selectedFloorId);
                const isConnected = floor.connections && selectedFloorId && floor.connections.has(selectedFloorId);
                if (isSelected || isConnected) {
                    newActiveFloors.add(floorId);
                }
            }
        }

        const conflictsWithActive = (candidateId: string): boolean => {
            const candidateConflicts = floorIdToConflicts.get(candidateId) || new Set<string>();
            for (const activeId of newActiveFloors) {
                const activeConflicts = floorIdToConflicts.get(activeId) || new Set<string>();
                if (activeConflicts.has(candidateId) || candidateConflicts.has(activeId)) return true;
            }
            return false;
        };

        // Add last active floors that still exist and don't conflict
        if (lastActiveFloors) {
            for (const lastActiveFloorId of lastActiveFloors) {
                if (!allFloors.has(lastActiveFloorId)) continue;
                if (!conflictsWithActive(lastActiveFloorId)) {
                    newActiveFloors.add(lastActiveFloorId);
                }
            }
        }

        // Add default floors that don't conflict
        for (const defaultFloorId of allDefaultFloors) {
            if (newActiveFloors.has(defaultFloorId)) continue;
            if (!conflictsWithActive(defaultFloorId)) {
                newActiveFloors.add(defaultFloorId);
            }
        }

        return newActiveFloors;
    }
}
