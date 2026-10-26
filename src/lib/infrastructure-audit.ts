export type AuditItem = { key: string; label: string };
export type AuditPhoto = { key: string; label: string };
export type AuditSection = {
  key: string;
  title: string;
  items: AuditItem[];
  photos: AuditPhoto[];
};

export const AUDIT_SECTIONS: AuditSection[] = [
  {
    key: "building",
    title: "1. Building Structure",
    items: [
      { key: "walls_no_cracks", label: "Walls: no cracks" },
      { key: "walls_plastered", label: "Walls plastered" },
      { key: "walls_painted", label: "Walls painted" },
      { key: "roof_no_leaks", label: "Roof: no leaks" },
      { key: "ceiling_intact", label: "Ceiling intact" },
      { key: "floor_washable", label: "Floor washable, not broken" },
      { key: "windows_intact", label: "Windows: glass not broken" },
      { key: "windows_ventilation", label: "Windows open for ventilation" },
      { key: "door_locks", label: "Door locks working" },
      { key: "no_sharp_edges", label: "No sharp edges" },
    ],
    photos: [
      { key: "side_front", label: "Building inside — front side" },
      { key: "side_back", label: "Building inside — back side" },
      { key: "side_left", label: "Building inside — left side" },
      { key: "side_right", label: "Building inside — right side" },
    ],
  },
  {
    key: "size",
    title: "2. Size & Capacity (measure L × W)",
    items: [],
    photos: [],
  },
  {
    key: "toilets",
    title: "3. Toilets & Hand Wash",
    items: [
      { key: "potty_ratio", label: "1 potty per 20 children" },
      { key: "toilet_ratio", label: "1 toilet per 20 staff" },
      { key: "basin_within_2m", label: "Hand wash basin within 2 m of toilet" },
      { key: "water_running_or_jojo", label: "Running water or JoJo tank with tap" },
      { key: "toilet_paper", label: "Toilet paper available" },
      { key: "clean_daily", label: "Cleaned daily (before & after photo proof)" },
    ],
    photos: [
      { key: "toilet_inside", label: "Inside toilet" },
      { key: "basin", label: "Hand wash basin" },
      { key: "toilet_paper", label: "Toilet paper" },
      { key: "toilet_outside", label: "Toilet outside" },
      { key: "clean_before", label: "Cleanliness — before" },
      { key: "clean_after", label: "Cleanliness — after" },
    ],
  },
  {
    key: "kitchen",
    title: "4. Kitchen",
    items: [
      { key: "separate_from_toilet", label: "Kitchen separate from toilet" },
      { key: "floor_washable", label: "Washable floor" },
      { key: "covered_bins", label: "Covered bins" },
      { key: "separate_tap", label: "Separate tap for food prep" },
      { key: "chemicals_locked", label: "Locked cupboards for chemicals" },
      { key: "no_paraffin", label: "No paraffin appliances" },
      { key: "nutrition_60day", label: "60-day nutrition log linked" },
    ],
    photos: [
      { key: "clean_before", label: "Kitchen before cleaning" },
      { key: "clean_after", label: "Kitchen after cleaning" },
      { key: "bin", label: "Covered bin" },
      { key: "cupboard_lock", label: "Chemical cupboard + lock" },
    ],
  },
  {
    key: "safety",
    title: "5. Safety",
    items: [
      { key: "fence_1_8m", label: "Fence at least 1.8 m high" },
      { key: "gate_locked", label: "Gate locked" },
      { key: "plugs_covered", label: "Electrical plugs covered" },
      { key: "no_hanging_wires", label: "No hanging wires" },
      { key: "sick_bay", label: "Sick bay / first aid corner with mattress" },
      { key: "fire_extinguisher", label: "Fire extinguisher, sand bucket or evacuation plan" },
      { key: "no_hazards_50m", label: "No hazards within 50 m (dump site, shipping containers, etc.)" },
    ],
    photos: [
      { key: "gate_lock", label: "Gate + lock" },
      { key: "first_aid", label: "First aid corner" },
      { key: "fire_equipment", label: "Fire extinguisher / sand bucket" },
    ],
  },
  {
    key: "water",
    title: "6. Water & Sanitation",
    items: [
      { key: "clean_water_source", label: "Clean water source" },
      { key: "ehs_certificate", label: "EHS certificate" },
      { key: "waste_disposal", label: "Waste disposal / municipal collection" },
      { key: "safe_pit_or_pest", label: "Safe pit or pest control certificate" },
    ],
    photos: [
      { key: "water_source", label: "Water source" },
      { key: "ehs_certificate", label: "EHS certificate" },
    ],
  },
  {
    key: "zoning",
    title: "7. Zoning (informal settlements)",
    items: [
      { key: "pto_letter", label: "PTO letter from the councillor" },
      { key: "municipal_letter", label: "Municipal letter" },
      { key: "not_wetland_floodline", label: "Not in wetland / flood line" },
      { key: "gps_captured", label: "GPS coordinates of centre captured" },
      { key: "informal_allowed", label: "Letter stating informal settlement allowed for ECD" },
    ],
    photos: [
      { key: "pto_letter", label: "PTO letter" },
      { key: "municipal_letter", label: "Municipal letter" },
    ],
  },
  {
    key: "bangasali",
    title: "8. Bana Pele / Registration",
    items: [
      { key: "photos_geotagged", label: "Photos geotagged and dated (DBE checks this)" },
    ],
    photos: [],
  },
];

export const AUDIT_TOTAL_ITEMS = AUDIT_SECTIONS.reduce((n, s) => n + s.items.length, 0);

export function auditScore(checked: string[]): number {
  return Math.round((checked.length / AUDIT_TOTAL_ITEMS) * 100);
}

/** Indoor play space: 1.5 m² per child. */
export const SQM_PER_CHILD_INDOOR = 1.5;
/** Outdoor play space: 2 m² per child. */
export const SQM_PER_CHILD_OUTDOOR = 2;

export function areaSqm(lengthM: number, widthM: number): number {
  return lengthM * widthM;
}

export function indoorCapacity(sqm: number): number {
  return Math.floor(sqm / SQM_PER_CHILD_INDOOR);
}

export function outdoorCapacity(sqm: number): number {
  return Math.floor(sqm / SQM_PER_CHILD_OUTDOOR);
}

/** 1 potty per 20 children. */
export function pottiesRequired(children: number): number {
  return Math.ceil(children / 20);
}

/** 1 toilet per 20 staff. */
export function staffToiletsRequired(staff: number): number {
  return Math.ceil(staff / 20);
}

export const AGE_GROUPS = ["0–18 months", "18 months–3 years", "3–4 years", "4–5 years", "5–6 years"];
