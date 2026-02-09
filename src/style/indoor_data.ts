export type IndoorData = {
    buildings: Record<string, IndoorBuilding>;
    activeFloors: Set<string>;
};

export type IndoorBuilding = {
    floorIds: Set<string>;
    center: [number, number];
    floors: Record<string, IndoorFloor>;
};

export type IndoorFloor = {
    name: string;
    zIndex: number;
};

export type IndoorEvents = {
    'selector-update': IndoorControlModel;
};

export type IndoorControlFloor = {
    id: string;
    name: string;
    zIndex: number;
};

export type IndoorControlModel = {
    selectedFloorId: string;
    activeFloorsVisible: boolean;
    floors: Array<IndoorControlFloor>;
};

export type IndoorTileOptions = {
    sourceLayers: Set<string> | null;
    indoorState: IndoorState | null;
};

export type IndoorState = {
    activeFloorsVisible: boolean;
    selectedFloorId: string | null;
    activeFloors: Set<string>;
};
