import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './api/app';
import { createEngine } from './engine';

const dataFile = process.env.GRAPH_FILE ?? path.join(__dirname, '..', 'data', 'train-ticket-be.json');
const port = Number(process.env.PORT ?? 3000);

const { deps, warnings } = createEngine(JSON.parse(readFileSync(dataFile, 'utf8')));
warnings.forEach((w) => console.warn(`[load-graph] ${w}`));

createApp(deps).listen(port, () => {
  console.log(
    `Graph query engine on http://localhost:${port} ` +
      `(${deps.graph.nodes.size} nodes, ${deps.graph.edges.length} edges, ${deps.routes.length} routes)`,
  );
});
