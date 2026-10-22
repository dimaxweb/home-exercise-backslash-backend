import { loadGraph } from '../graph/load-graph';
import { Graph } from '../graph/types';

export const rawFixture = {
  nodes: [
    { name: 'web', kind: 'service', publicExposed: true },
    { name: 'api', kind: 'service', vulnerabilities: [{ file: 'Api.java', severity: 'high', message: 'sqli' }] },
    { name: 'worker', kind: 'service' },
    { name: 'db', kind: 'rds' },
    { name: 'queue', kind: 'sqs' },
    { name: 'lonely', kind: 'service' },
  ],
  edges: [
    { from: 'web', to: ['api', 'worker'] },
    { from: 'api', to: 'db' },
    { from: 'worker', to: ['queue'] },
  ],
};

export const fixtureGraph = (): Graph => loadGraph(rawFixture).graph;
