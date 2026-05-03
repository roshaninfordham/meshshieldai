// AUTO-GENERATED FROM packages/protocol/schemas — do not edit

export interface SensorMessage {
  v: 1;
  node_id: string;
  ts: number;
  detections: {
    class: string;
    conf: number;
    bearing_deg: number;
    elev_deg: number;
    /**
     * @minItems 4
     * @maxItems 4
     */
    px_box: [number, number, number, number];
  }[];
}
