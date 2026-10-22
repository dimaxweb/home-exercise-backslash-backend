import { defaultRegistry, endsInSink, hasVulnerability, startsPublic } from '../../src/filters/built-in';
import { fixtureGraph } from '../../src/testing/fixtures';

const graph = fixtureGraph();
const toDb = ['web', 'api', 'db'];
const toQueue = ['web', 'worker', 'queue'];
const lonely = ['lonely'];

describe('built-in filters', () => {
  it('starts-public: first node is publicly exposed', () => {
    expect(startsPublic.matches(toDb, graph)).toBe(true);
    expect(startsPublic.matches(lonely, graph)).toBe(false);
  });

  it('ends-in-sink: last node is rds (sqs is not a sink)', () => {
    expect(endsInSink.matches(toDb, graph)).toBe(true);
    expect(endsInSink.matches(toQueue, graph)).toBe(false);
  });

  it('has-vulnerability: any node has vulnerabilities', () => {
    expect(hasVulnerability.matches(toDb, graph)).toBe(true);
    expect(hasVulnerability.matches(toQueue, graph)).toBe(false);
  });

  it('defaultRegistry exposes the three built-ins', () => {
    expect(defaultRegistry().names()).toEqual(['starts-public', 'ends-in-sink', 'has-vulnerability']);
  });
});
