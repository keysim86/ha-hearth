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
}

export interface DeviceReg {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
  area_id?: string | null;
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
  config?: { time_zone?: string };
  user?: { is_admin?: boolean };
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
}

export type Style = "tiles" | "list" | "dials";

export interface Options {
  style: Style;
  sidebar_title?: string;
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
  boiler_state?: string | null;
  boiler_flow_temperature?: string | null;
  boiler_pressure?: string | null;
  dhw_temperature?: string | null;
  presence?: string | null;
  tariff?: string | null;
}

export interface PanelInfo {
  config: { options: Options; version: string };
}
