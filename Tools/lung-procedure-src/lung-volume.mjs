// Distance from the BodyParts3D lung volume, in source millimetres.
// The lungs are voxelized (1 mm) and dilated outward by breadth-first search,
// so distance(p) is 0 inside a lung, 1…40 mm outside, and 99 beyond the grid.
// Shared by the airway route tracing and the procedure mesh build, so both
// agree on what "inside the lung" means.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { voxelize } from './voxelize.mjs';

function readObj(path) {
  const positions = [], indices = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith('f ')) {
      const face = line.trim().split(/\s+/).slice(1).map(part => parseInt(part, 10) - 1);
      for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i], face[i + 1]);
    }
  }
  return { positions, indices };
}

// subsetRoot is .../body-parts-source/procedure-subset; the lungs are in its sibling lung-subset.
export function loadLungVolume(subsetRoot) {
  const dir = join(subsetRoot, '..', 'lung-subset', 'lungs');
  const lungs = readdirSync(dir).filter(name => name.endsWith('.obj')).map(name => readObj(join(dir, name)));
  const { grid, lo, dims: [NX, NY, NZ], step } = voxelize(lungs);
  const distance = new Uint8Array(grid.length).fill(255);
  let frontier = [];
  for (let i = 0; i < grid.length; i++) if (grid[i]) { distance[i] = 0; frontier.push(i); }
  const neighbours = [1, -1, NX, -NX, NX * NY, -NX * NY];
  for (let d = 1; d <= 40 && frontier.length; d++) {
    const next = [];
    for (const i of frontier) for (const o of neighbours) {
      const j = i + o;
      if (j >= 0 && j < grid.length && distance[j] === 255) { distance[j] = d; next.push(j); }
    }
    frontier = next;
  }
  return {
    distance(p) {
      const i = Math.floor((p[0] - lo[0]) / step), j = Math.floor((p[1] - lo[1]) / step), k = Math.floor((p[2] - lo[2]) / step);
      if (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) return 99;
      return distance[(k * NY + j) * NX + i];
    }
  };
}
