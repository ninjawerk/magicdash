export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & { friendly_name?: string; unit_of_measurement?: string; device_class?: string; icon?: string };
  last_changed: string;
  last_updated: string;
}

export interface HaStatus {
  configured: boolean;
  connected: boolean;
  entities: number;
  error?: string;
  version?: string;
}

export const TOGGLE_DOMAINS = new Set(['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'siren', 'automation']);
export const ACTIVATE_DOMAINS = new Set(['scene', 'script', 'button', 'input_button']);

export function domainOf(entityId: string) {
  return entityId.split('.')[0];
}
