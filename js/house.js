/* A procedural brick house with a hip roof, built from simple parts: a plinth that steps out, a belt between the storeys and
   a corbelled cornice; windows with a mullion, a metal sill and a brick lintel; an entrance with a door, steps and a canopy;
   soffits, a fascia, gutters and downpipes, caps on the ridge and the hips and a chimney. Every part is its own mesh; the
   static merge (merge.js) joins them afterwards, so a house costs only a few draw calls. three.js r128.

   House.build(group, {x1, z1, x2, z2, storeys, wall, roof, info})  — plan in metres, x to the east, z to the south;
   the front with the door is the z1 side. House.brick([r, g, b], seed) makes a brick material drawn on a canvas. */
(function (root) {
  const std = (c, extra) => MICRO.apply(new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.85}, extra || {})));
  const MAT = {
    plinth: std(0x26282c), sill: std(0xd6d9db, {roughness: 0.45, metalness: 0.3}), soffit: std(0xe9e5dc),
    frame: std(0xf1f1ec, {roughness: 0.5}), glass: std(0x5d7280, {roughness: 0.12, metalness: 0.2}),
    door: std(0x5b3d2b, {roughness: 0.6}), step: std(0x9b978f)
  };

  // brick in courses on a lighter joint: 4 bricks × 8 courses per tile, every brick a little different
  function brick(rgb, seed) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    let s = seed || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#a49a8e'; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) {
      const t = 1 + (rnd() - 0.5) * 0.3, off = r % 2 ? 64 : 0;
      g.fillStyle = `rgb(${rgb.map(v => Math.min(255, v * t) | 0).join(',')})`;
      g.fillRect(k * 128 + off + 3, r * 64 + 4, 122, 56);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return std(0xffffff, {map: t, roughness: 0.9});
  }
  // world-space UVs, so the brick keeps its size on every wall: 1 tile = 1.04 m × 0.60 m
  function wallUV(g) {
    const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const u = ay > 0.7 ? p.getX(i) : (ax > 0.7 ? p.getZ(i) : p.getX(i)), v = ay > 0.7 ? p.getZ(i) : p.getY(i);
      uv[i * 2] = u / 1.04; uv[i * 2 + 1] = v / 0.60;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  function build(G, o) {
    const {x1, z1, x2, z2} = o, storeys = o.storeys || 2, wall = o.wall, roof = o.roof, info = o.info || null;
    const h = storeys === 1 ? 3.4 : 6.4, rh = 2.6, e = 0.5, w = x2 - x1, d = z2 - z1, zc = (z1 + z2) / 2;
    const add = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.info = info; G.add(mesh); return mesh; };
    const box = (ax, az, bx, bz, y1, y2, m) => {
      const g = new THREE.BoxGeometry(Math.abs(bx - ax), y2 - y1, Math.abs(bz - az));
      g.translate((ax + bx) / 2, (y1 + y2) / 2, (az + bz) / 2); if (m.map) wallUV(g); return add(g, m);
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = new THREE.Vector3(0, 1, 0);
    const beam = (a, b, bw, bh, m) => {                       // a box between two points, level across
      const dir = b.clone().sub(a), len = dir.length(), g = new THREE.BoxGeometry(bw, bh, len);
      const mesh = add(g, m); mesh.position.copy(a).addScaledVector(dir, 0.5); mesh.lookAt(b); return mesh;
    };
    const cyl = (a, b, r, m) => {
      const dir = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, dir.length(), 8, 1);
      const mesh = add(g, m); mesh.position.copy(a).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(Y, dir.normalize()); return mesh;
    };
    // walls, plinth, belts, cornice
    box(x1 - 0.05, z1 - 0.05, x2 + 0.05, z2 + 0.05, 0, 0.5, MAT.plinth);
    box(x1 - 0.06, z1 - 0.06, x2 + 0.06, z2 + 0.06, 0.5, 0.56, MAT.sill);
    box(x1, z1, x2, z2, 0.5, h, wall);
    for (let s = 1; s < storeys; s++) { const y = 0.5 + s * 2.9 - 0.35; box(x1 - 0.04, z1 - 0.04, x2 + 0.04, z2 + 0.04, y, y + 0.2, wall); }
    box(x1 - 0.06, z1 - 0.06, x2 + 0.06, z2 + 0.06, h - 0.26, h - 0.13, wall);
    box(x1 - 0.12, z1 - 0.12, x2 + 0.12, z2 + 0.12, h - 0.13, h, wall);
    // hip roof
    const A = V(x1 - e + w / 2 - 0.6, h + rh, zc), B = V(x2 + e - w / 2 + 0.6, h + rh, zc);
    const c11 = V(x1 - e, h, z1 - e), c21 = V(x2 + e, h, z1 - e), c12 = V(x1 - e, h, z2 + e), c22 = V(x2 + e, h, z2 + e);
    const tris = [[c11, B, c21], [c11, A, B], [c12, c22, B], [c12, B, A], [c11, c12, A], [c21, B, c22]];
    const rp = []; tris.forEach(t => t.forEach(p => rp.push(p.x, p.y, p.z)));
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.computeVertexNormals();
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(rp.length / 3 * 2).fill(0), 2));
    add(rg, roof);
    const up = p => p.clone().add(V(0, 0.05, 0));
    beam(up(A), up(B), 0.22, 0.09, roof);
    [[c11, A], [c12, A], [c21, B], [c22, B]].forEach(([p, q]) => beam(up(p), up(q), 0.18, 0.07, roof));
    // soffits, fascia, gutters, downpipes
    box(x1 - e, z1 - e, x2 + e, z1, h - 0.03, h, MAT.soffit); box(x1 - e, z2, x2 + e, z2 + e, h - 0.03, h, MAT.soffit);
    box(x1 - e, z1, x1, z2, h - 0.03, h, MAT.soffit); box(x2, z1, x2 + e, z2, h - 0.03, h, MAT.soffit);
    box(x1 - e - 0.02, z1 - e - 0.02, x2 + e + 0.02, z1 - e, h - 0.2, h + 0.02, roof);
    box(x1 - e - 0.02, z2 + e, x2 + e + 0.02, z2 + e + 0.02, h - 0.2, h + 0.02, roof);
    box(x1 - e - 0.02, z1 - e, x1 - e, z2 + e, h - 0.2, h + 0.02, roof);
    box(x2 + e, z1 - e, x2 + e + 0.02, z2 + e, h - 0.2, h + 0.02, roof);
    box(x1 - e - 0.02, z1 - e - 0.15, x2 + e + 0.02, z1 - e - 0.02, h - 0.16, h - 0.04, roof);
    box(x1 - e - 0.02, z2 + e + 0.02, x2 + e + 0.02, z2 + e + 0.15, h - 0.16, h - 0.04, roof);
    [[x1 + 0.2, z1 - e - 0.08, z1 - 0.05], [x2 - 0.2, z1 - e - 0.08, z1 - 0.05], [x1 + 0.2, z2 + e + 0.08, z2 + 0.05], [x2 - 0.2, z2 + e + 0.08, z2 + 0.05]]
      .forEach(([px, pz, wz]) => { const k = V(px, h - 0.45, wz), b = V(px, 0.35, wz);
        cyl(V(px, h - 0.16, pz), k, 0.045, roof); cyl(k, b, 0.045, roof); cyl(b, V(px, 0.12, wz + (wz < zc ? -0.25 : 0.25)), 0.045, roof); });
    // chimney through the back slope
    const chx = x1 + w * 0.62, chz = zc + d * 0.12;
    box(chx, chz, chx + 0.64, chz + 0.52, h, h + rh + 0.7, wall);
    box(chx - 0.06, chz - 0.06, chx + 0.7, chz + 0.58, h + rh + 0.7, h + rh + 0.78, MAT.sill);
    // windows: ax 'z' — on a wall at z = f, running along x; sg — which way is out
    const win = (ax, f, sg, a0, y, ww, hh) => {
      const bx = (u1, u2, n1, n2, y1, y2, m) => ax === 'z' ? box(u1, f + sg * n1, u2, f + sg * n2, y1, y2, m) : box(f + sg * n1, u1, f + sg * n2, u2, y1, y2, m);
      bx(a0, a0 + ww, 0, 0.05, y, y + hh, MAT.frame);
      bx(a0 + 0.07, a0 + ww - 0.07, 0.05, 0.055, y + 0.07, y + hh - 0.07, MAT.glass);
      bx(a0 + ww / 2 - 0.035, a0 + ww / 2 + 0.035, 0.05, 0.075, y + 0.07, y + hh - 0.07, MAT.frame);
      bx(a0 - 0.08, a0 + ww + 0.08, 0, 0.17, y - 0.05, y, MAT.sill);
      bx(a0 - 0.13, a0 + ww + 0.13, 0, 0.03, y + hh, y + hh + 0.2, wall);
    };
    for (let s = 0; s < storeys; s++) { const y = 1.3 + s * 2.9;
      for (let wx = x1 + 1.2; wx < x2 - 1.0; wx += 2.6) { win('z', z1, -1, wx, y, 1.2, 1.4); win('z', z2, 1, wx, y, 1.2, 1.4); }
      for (let wz = z1 + 2.4; wz < z2 - 1.6; wz += 4.0) { win('x', x1, -1, wz, y, 1.0, 1.4); win('x', x2, 1, wz, y, 1.0, 1.4); } }
    // the entrance
    const dx = x1 + Math.min(w - 1.25, 7.9);
    box(dx - 0.08, z1, dx + 0.98, z1 - 0.04, 0.56, 2.72, MAT.frame);
    box(dx, z1 - 0.04, dx + 0.9, z1 - 0.06, 0.56, 2.64, MAT.door);
    box(dx + 0.72, z1 - 0.06, dx + 0.76, z1 - 0.12, 1.5, 1.62, MAT.sill);
    for (let k = 0; k < 3; k++) box(dx - 0.35, z1 - 0.05, dx + 1.25, z1 - 1.25 + k * 0.3, 0, 0.19 + k * 0.185, MAT.step);
    box(dx - 0.45, z1, dx + 1.35, z1 - 1.3, 2.95, 3.03, roof);
    [dx - 0.3, dx + 1.2].forEach(bx => beam(V(bx, 2.55, z1 - 0.02), V(bx, 2.95, z1 - 1.0), 0.05, 0.05, MAT.sill));
  }
  root.House = {build, brick, std};
})(window);
