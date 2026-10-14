// Minimalne typy obiektu `hass`, którego używa panel (pełne typy żyją w home-assistant/frontend).

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface EntityReg {
  entity_id: string;
  name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  hidden?: boolean;
  entity_category?: string | null;
  platform?: string;
  translation_key?: string;
}

export interface DeviceReg {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
  area_id?: string | null;
  model?: string | null;
  manufacturer?: string | null;
}

export interface AreaReg {
  area_id: string;
  name: string;
  icon?: string | null;
  floor_id?: string | null;
}

export interface Hass {
  states: Record<string, HassEntity>;
  entities: Record<string, EntityReg>;
  devices: Record<string, DeviceReg>;
  areas: Record<string, AreaReg>;
  themes?: { darkMode?: boolean };
  config?: { time_zone?: string; latitude?: number; longitude?: number };
  user?: { is_admin?: boolean };
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
}

export type Style = "tiles" | "list" | "dials";
export type Tab = "home" | "climate" | "switches" | "energy" | "boiler" | "meters" | "network" | "cameras" | "cars" | "robots" | "proxmox" | "health" | "agent" | "alerts";

export interface Options {
  style: Style;
  tabs?: Tab[];
  sidebar_title?: string;
  // Klimat
  helper_prefix?: string;
  areas?: string[];
  fans?: string[];
  exclude_entities?: string[];
  outdoor_temperature?: string | null;
  outdoor_humidity?: string | null;
  outdoor_pressure?: string | null;
  outdoor_illuminance?: string | null;
  outdoor_pm25?: string | null;
  outdoor_pm10?: string | null;
  outdoor_aqi?: string | null;
  outdoor_aqi_level?: string | null;
  presence?: string | null;
  tariff?: string | null;
  // Dom
  persons?: string[];
  gates?: string[];
  mailbox?: string | null;
  mailbox_battery?: string | null;
  waste?: string[];
  waste_calendar?: string | null;
  waste_toggles?: string[];
  weather?: string | null;
  // Energia
  power_total?: string | null;
  phase_power?: string[];
  phase_voltage?: string[];
  consumers?: string[];
  consumers_exclude?: string[];
  // Kocioł
  climate_heating?: string | null;
  climate_dhw?: string | null;
  boiler_state?: string | null;
  boiler_flame?: string | null;
  boiler_dhw_demand?: string | null;
  boiler_ignition?: string | null;
  boiler_pump?: string | null;
  boiler_modulation?: string | null;
  boiler_fan_speed?: string | null;
  boiler_flow_temperature?: string | null;
  boiler_flow_target?: string | null;
  boiler_return_temperature?: string | null;
  boiler_pressure?: string | null;
  boiler_heat_curve?: string | null;
  boiler_outdoor?: string | null;
  boiler_outdoor_avg?: string | null;
  dhw_temperature?: string | null;
  dhw_target?: string | null;
  gas?: string[];
  boiler_settings?: string[];
  ebusd_zone_topic?: string;
  boiler_sf_mode?: string | null;
  veto_end_date?: string | null;
  veto_end_time?: string | null;
  // Liczniki
  meters?: string[];
  // Przełączniki, kamery, auta, roboty, Proxmox, sieć, alerty, agent
  switch_exclude?: string[];
  cameras?: string[];
  nvr_status?: string | null;
  nvr_version?: string | null;
  nvr_channels?: string | null;
  nvr_storage_used?: string | null;
  nvr_storage_total?: string | null;
  vehicles?: string[];
  robots_exclude?: string[];
  proxmox_exclude?: string[];
  proxmox_disks?: Array<{ guest: string; label?: string; used: string; total: string }>;
  net_speed?: string[];
  net_status?: string[];
  net_updates?: string[];
  net_ports?: string[];
  alerts?: Array<{ entity: string; condition: string; message: string; severity?: string }>;
  agent_url?: string;
}

export interface Route {
  prefix: string;
  path: string;
}

export type Measurement = "neck" | "chest" | "abdomen" | "waist" | "hips" | "thigh" | "calf" | "biceps";

export interface HealthGoal {
  label: string;
  weight: number;
  date?: string;
  color?: string;
}

/** Osoba z zakładki Zdrowie (podwpis integracji); puste pola nie przychodzą wcale. */
export interface HealthProfile {
  id: string;
  name: string;
  person?: string;
  gender: "male" | "female";
  birthdate?: string;
  weight: string;
  height?: string;
  height_cm?: number;
  start_weight?: number;
  start_date?: string;
  history_days: number;
  body_fat?: string;
  fat_mass?: string;
  lean_mass?: string;
  muscle_mass?: string;
  skeletal_muscle?: string;
  bone_mass?: string;
  body_water?: string;
  bmr?: string;
  steps?: string;
  calories?: string;
  steps_goal: number;
  calories_goal: number;
  bp_systolic?: string;
  bp_diastolic?: string;
  bp_pulse?: string;
  bp_category?: string;
  report_name?: string;
  report_device?: string;
  bp_exclude: string[];
  data_entry: boolean;
  bp_systolic_input?: string;
  bp_diastolic_input?: string;
  bp_pulse_input?: string;
  goals: HealthGoal[];
  centiles: boolean;
  [key: `meas_${string}` | `input_${string}`]: string | undefined;
}

export interface PanelInfo {
  config: { options: Options; health?: HealthProfile[]; version: string };
}
