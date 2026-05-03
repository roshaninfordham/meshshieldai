// AUTO-GENERATED FROM packages/protocol/schemas — do not edit

export interface Snapshot {
  v: 1;
  snapshot_id: string;
  ts: number;
  tracks: {
    id: string;
    origin: "real" | "simulated";
    /**
     * @minItems 3
     * @maxItems 3
     */
    pos_3d: [number, number, number];
    /**
     * @minItems 3
     * @maxItems 3
     */
    vel: [number, number, number];
    conf: number;
    nearest_asset_m?: number;
  }[];
}
