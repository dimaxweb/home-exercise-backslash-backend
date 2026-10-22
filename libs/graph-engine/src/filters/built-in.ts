import { isSink, isVulnerable } from '../graph/node-risk';
import { FilterRegistry } from './registry';
import { RouteFilter } from './types';

export const FilterName = {
  StartsPublic: 'starts-public',
  EndsInSink: 'ends-in-sink',
  HasVulnerability: 'has-vulnerability',
} as const;

export const startsPublic: RouteFilter = {
  name: FilterName.StartsPublic,
  description: 'Route starts at a publicly exposed service',
  matches: (route, graph) => graph.nodes.get(route[0])?.publicExposed === true,
};

export const endsInSink: RouteFilter = {
  name: FilterName.EndsInSink,
  description: 'Route ends at a sink (rds)',
  matches: (route, graph) => {
    const last = graph.nodes.get(route[route.length - 1]);
    return last !== undefined && isSink(last);
  },
};

export const hasVulnerability: RouteFilter = {
  name: FilterName.HasVulnerability,
  description: 'Route passes through a node with at least one vulnerability',
  matches: (route, graph) =>
    route.some((id) => {
      const node = graph.nodes.get(id);
      return node !== undefined && isVulnerable(node);
    }),
};

export function defaultRegistry(): FilterRegistry {
  return new FilterRegistry().register(startsPublic).register(endsInSink).register(hasVulnerability);
}
