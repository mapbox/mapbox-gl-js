export type IndoorData = {
    buildings: Array<IndoorDataBuilding>;
    floors: Array<IndoorDataFloor>;
    defaultFloors: Set<string>;
};

export type IndoorDataBuilding = {
    id: string;
    name: string;
    center: [number, number];
};

export type IndoorDataFloor = {
    id: string;
    name: string;
    isDefault: boolean;
    zIndex: number;
    connectedFloorIds: Array<string> | null;
    conflictedFloorIds: Array<string> | null;
    buildingIds: Array<string> | null;
};

export type IndoorEvents = {
    'indoorupdate': {
        selectedFloorId: string;
        showBuildingsOverview: boolean;
        floors: Array<{
            id: string;
            name: string;
            shortName: string;
            levelOrder: number;
        }>;
    };
};

export type IndoorVectorTileOptions = {
    isEnabled: boolean;
    sourceLayers: Set<string> | null;
    activeFloors: Set<string> | null;
};
