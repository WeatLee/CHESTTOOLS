// Solid voxel occupancy for closed BodyParts3D meshes (source millimetres).
// Each piece is filled by ray parity along z; overlapping pieces are OR-ed.
export function voxelize(pieces, step = 1, pad = 4) {
  const all = pieces.flatMap(p => p.positions);
  const lo = [0, 1, 2].map(k => Math.floor(Math.min(...all.map(p => p[k]))) - pad);
  const hi = [0, 1, 2].map(k => Math.ceil(Math.max(...all.map(p => p[k]))) + pad);
  const dims = hi.map((v, k) => Math.ceil((v - lo[k]) / step));
  const [NX, NY, NZ] = dims;
  const grid = new Uint8Array(NX * NY * NZ);
  for (const { positions: v, indices } of pieces) {
    const columns = new Map();
    for (let t = 0; t < indices.length; t += 3) {
      const A = v[indices[t]], B = v[indices[t + 1]], C = v[indices[t + 2]];
      const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(d) < 1e-12) continue;
      const i0 = Math.ceil((Math.min(A[0], B[0], C[0]) - lo[0]) / step - .5), i1 = Math.floor((Math.max(A[0], B[0], C[0]) - lo[0]) / step - .5);
      const j0 = Math.ceil((Math.min(A[1], B[1], C[1]) - lo[1]) / step - .5), j1 = Math.floor((Math.max(A[1], B[1], C[1]) - lo[1]) / step - .5);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = lo[0] + (i + .5) * step, y = lo[1] + (j + .5) * step;
        const w1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d;
        const w2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const key = i * 65536 + j;
        (columns.get(key) || columns.set(key, []).get(key)).push(w1 * A[2] + w2 * B[2] + w3 * C[2]);
      }
    }
    for (const [key, zs] of columns) {
      const i = Math.floor(key / 65536), j = key % 65536;
      if (i < 0 || j < 0 || i >= NX || j >= NY) continue;
      zs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < zs.length; n += 2) {
        const k0 = Math.max(0, Math.ceil((zs[n] - lo[2]) / step - .5)), k1 = Math.min(NZ - 1, Math.floor((zs[n + 1] - lo[2]) / step - .5));
        for (let k = k0; k <= k1; k++) grid[(k * NY + j) * NX + i] = 1;
      }
    }
  }
  const inside = p => {
    const i = Math.floor((p[0] - lo[0]) / step), j = Math.floor((p[1] - lo[1]) / step), k = Math.floor((p[2] - lo[2]) / step);
    return i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ && grid[(k * NY + j) * NX + i] === 1;
  };
  return { inside, lo, dims, step, grid };
}
