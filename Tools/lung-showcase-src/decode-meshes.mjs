// Node-side decoders for the packed meshes (LUNG1, PROC1, ORGN1), used by the build
// scripts and tests. Every mesh comes back as { positions: [[x,y,z]...], indices: [...] }
// in scene units. The data files are shared with the Procedure page.
import { gunzipSync } from 'node:zlib';
import lungData from '../lung-procedure-src/src/lung-mesh-data.js';
import procedureData from '../lung-procedure-src/src/procedure-mesh-data.js';
import organData from '../lung-procedure-src/src/organ-mesh-data.js';

export function decodeLungs() {
  const b = gunzipSync(Buffer.from(lungData, 'base64')), meshes = {};
  for (let at = 6, g = 0; g < b[5]; g++) {
    const key = b.toString('ascii', at, at + 3), nv = b.readUInt32LE(at + 3), ni = b.readUInt32LE(at + 7); at += 11;
    const positions = Array.from({ length: nv }, (_, i) => [0, 1, 2].map(k => b.readFloatLE(at + (i * 3 + k) * 4)));
    at += nv * 12;
    const indices = Array.from({ length: ni }, (_, i) => b.readUInt32LE(at + i * 4));
    at += ni * 4;
    meshes[key] = { positions, indices };
  }
  return meshes;
}

export function decodeProcedure() {
  const b = gunzipSync(Buffer.from(procedureData, 'base64')), meshes = {};
  for (let at = 6, g = 0; g < b[5]; g++) {
    const key = b.toString('ascii', at, at + 4), nv = b.readUInt32LE(at + 4), ni = b.readUInt32LE(at + 8), wide = b[at + 12];
    const origin = [0, 1, 2].map(k => b.readFloatLE(at + 13 + k * 4)), step = b.readFloatLE(at + 25);
    at += 29;
    const positions = Array.from({ length: nv }, (_, i) => [0, 1, 2].map(k => origin[k] + b.readUInt16LE(at + (i * 3 + k) * 2) * step));
    at += nv * 6;
    const indices = Array.from({ length: ni }, (_, i) => wide ? b.readUInt32LE(at + i * 4) : b.readUInt16LE(at + i * 2));
    at += ni * (wide ? 4 : 2);
    meshes[key] = { positions, indices };
  }
  return meshes;
}

export function decodeOrgans() {
  const b = gunzipSync(Buffer.from(organData, 'base64')), meshes = {};
  for (let at = 6, g = 0; g < b[5]; g++) {
    const key = b.toString('ascii', at, at + 4), nv = b.readUInt32LE(at + 4), ni = b.readUInt32LE(at + 8); at += 12;
    const positions = Array.from({ length: nv }, (_, i) => [0, 1, 2].map(k => b.readFloatLE(at + (i * 3 + k) * 4)));
    at += nv * 12;
    const indices = Array.from({ length: ni }, (_, i) => b.readUInt32LE(at + i * 4));
    at += ni * 4;
    meshes[key] = { positions, indices };
  }
  return meshes;
}
