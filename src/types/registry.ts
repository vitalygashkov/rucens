export const restrictionTypes = ['rkn_blocked', 'region_not_supported'] as const;

export type RestrictionType = (typeof restrictionTypes)[number];

export const serviceCategories = [
  'adult',
  'ai',
  'anime',
  'developer',
  'education',
  'email',
  'messenger',
  'music',
  'productivity',
  'social',
  'tools',
  'torrent',
  'translation',
  'video',
  'vpn',
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export interface IpRoutesBatSource {
  kind: 'ip_routes_bat';
  path: string;
}

export interface DomainListSource {
  kind: 'domain_list_txt';
  path: string;
}

export interface JsonFeedSource {
  kind: 'json_feed';
  url: string;
}

export type ServiceSource = IpRoutesBatSource | DomainListSource | JsonFeedSource;

export interface ServiceEntry {
  id: string;
  name: string;
  category: ServiceCategory;
  restrictionType: RestrictionType;
  sources: ServiceSource[];
}

export const restrictionTypeLabels: Record<RestrictionType, string> = {
  rkn_blocked: 'Blocked by Roskomnadzor',
  region_not_supported: "Service doesn't support Russia",
};
