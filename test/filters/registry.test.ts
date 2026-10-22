import { FilterRegistry } from '../../src/filters/registry';
import { RouteFilter } from '../../src/filters/types';

const longRoute: RouteFilter = {
  name: 'long-route',
  description: 'Route has at least 3 nodes',
  matches: (route) => route.length >= 3,
};

describe('FilterRegistry', () => {
  it('registers and looks up a custom filter', () => {
    const registry = new FilterRegistry().register(longRoute);
    expect(registry.get('long-route')).toBe(longRoute);
    expect(registry.names()).toEqual(['long-route']);
    expect(registry.list()).toEqual([longRoute]);
  });

  it('returns undefined for an unknown filter', () => {
    expect(new FilterRegistry().get('nope')).toBeUndefined();
  });

  it('rejects a duplicate name', () => {
    const registry = new FilterRegistry().register(longRoute);
    expect(() => registry.register(longRoute)).toThrow(/already registered/);
  });
});
