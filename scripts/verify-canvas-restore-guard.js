const fs = require('fs');
const path = require('path');
const vm = require('vm');

const guardPath = path.join(__dirname, '..', 'assets', 'canvas-project-restore-guard.js');
const source = fs.readFileSync(guardPath, 'utf8');
const store = new Map();

store.set('ai-canvas-projects-summary', JSON.stringify([
  {
    id: 'project_sample',
    name: '示例项目',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    canvasData: { nodes: [], edges: [] }
  },
  {
    id: 'project_user',
    name: '真实项目',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    canvasData: {
      nodes: [{ id: 'custom_node', type: 'text', position: { x: 1, y: 1 }, data: { content: 'keep' } }],
      edges: []
    }
  }
]));

const context = {
  console,
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  }
};

vm.createContext(context);
vm.runInContext(source, context, { filename: guardPath });

const repaired = JSON.parse(store.get('ai-canvas-projects-summary'));
const sample = repaired.find((project) => project.name === '示例项目');
const userProject = repaired.find((project) => project.id === 'project_user');

if (!sample || !Array.isArray(sample.canvasData.nodes) || sample.canvasData.nodes.length !== 2) {
  throw new Error('Sample project was not repaired with 2 nodes');
}

if (!Array.isArray(sample.canvasData.edges) || sample.canvasData.edges.length !== 1) {
  throw new Error('Sample project was not repaired with 1 edge');
}

if (!userProject || userProject.canvasData.nodes[0].id !== 'custom_node') {
  throw new Error('Non-sample project was unexpectedly changed');
}

console.log('Canvas restore guard verification passed.');
