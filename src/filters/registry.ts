import { RouteFilter } from './types';

export class FilterRegistry {
  private readonly filters = new Map<string, RouteFilter>();

  register(filter: RouteFilter): this {
    if (this.filters.has(filter.name)) throw new Error(`Filter "${filter.name}" is already registered`);
    this.filters.set(filter.name, filter);
    return this;
  }

  get(name: string): RouteFilter | undefined {
    return this.filters.get(name);
  }

  list(): RouteFilter[] {
    return [...this.filters.values()];
  }

  names(): string[] {
    return [...this.filters.keys()];
  }
}
