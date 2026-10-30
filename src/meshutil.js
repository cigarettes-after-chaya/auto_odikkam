// Converts Builder output (typed arrays) into THREE geometry / meshes.
import { T } from './three-ref.js';

export function geometryFromBuffer(buf) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(buf.pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(buf.nor, 3));
  g.setAttribute('uv', new T.BufferAttribute(buf.uv, 2));
  g.setAttribute('color', new T.BufferAttribute(buf.col, 3));
  g.setIndex(new T.BufferAttribute(buf.idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Adds one mesh per material bucket to `parent`. `materials[key]` falls back to materials.paint.
export function addBuffers(parent, buffers, materials, { cast = true, receive = true } = {}) {
  const made = [];
  for (const buf of buffers) {
    const mesh = new T.Mesh(geometryFromBuffer(buf), materials[buf.key] || materials.paint);
    mesh.castShadow = cast && !(materials[buf.key] && materials[buf.key].userData.noShadow);
    mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    parent.add(mesh); made.push(mesh);
  }
  return made;
}

export function disposeObject(root) {
  root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
