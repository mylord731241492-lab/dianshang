(function () {
  var SUMMARY_KEY = 'ai-canvas-projects-summary';
  var LEGACY_KEY = 'ai-canvas-projects';

  function parseList(value) {
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function isEmptyCanvas(canvasData) {
    if (!canvasData || typeof canvasData !== 'object') return true;
    return !Array.isArray(canvasData.nodes) || canvasData.nodes.length === 0;
  }

  function buildSampleCanvas(existing) {
    return Object.assign({}, existing || {}, {
      nodes: [
        {
          id: 'node_0',
          type: 'text',
          position: { x: 150, y: 150 },
          data: {
            content: '一只金毛寻回犬在草地上奔跑，摇着尾巴，脸上带着快乐的表情。它的毛发在阳光下闪耀，眼神充满对自由的渴望，整体氛围阳光、友善。',
            label: '文本输入'
          }
        },
        {
          id: 'node_1',
          type: 'imageConfig',
          position: { x: 500, y: 150 },
          data: {
            prompt: '',
            model: 'doubao-seedream-4-5-251128',
            size: '512x512',
            label: '文生图'
          }
        }
      ],
      edges: [
        {
          id: 'edge_node_0_node_1',
          source: 'node_0',
          target: 'node_1',
          sourceHandle: 'right',
          targetHandle: 'left'
        }
      ]
    });
  }

  function repairSummary() {
    try {
      var raw = localStorage.getItem(SUMMARY_KEY) || localStorage.getItem(LEGACY_KEY);
      var projects = parseList(raw);
      if (!projects.length) return;

      var changed = false;
      var repaired = projects.map(function (project) {
        if (!project || project.name !== '示例项目' || !isEmptyCanvas(project.canvasData)) {
          return project;
        }
        changed = true;
        return Object.assign({}, project, {
          canvasData: buildSampleCanvas(project.canvasData),
          updatedAt: project.updatedAt || new Date().toISOString()
        });
      });

      if (changed) {
        localStorage.removeItem(LEGACY_KEY);
        localStorage.setItem(SUMMARY_KEY, JSON.stringify(repaired));
        console.info('[canvas-project-restore-guard] repaired empty sample project summary');
      }
    } catch (error) {
      console.warn('[canvas-project-restore-guard] skipped:', error);
    }
  }

  repairSummary();
})();
