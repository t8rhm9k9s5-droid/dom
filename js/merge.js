/* Static merge: a scene drawn as thousands of separate meshes costs a draw call each (and again for every shadow map).
   Every still mesh is joined with its neighbours of the same material, the same picking card (userData.info) and the same shadow
   flags, in square cells of the ground plan, so the camera can still skip whatever is off screen. Identical materials made
   separately are made one first, so their meshes can be joined too. Meshes with several materials are split by material.
   Call once after the scene is built, when nothing moves any more. three.js r128.

   autoMerge(root, {cell = 8, keep = o => false, fixed = []}) → {meshes, joined, made, materials}
     root   the group (or scene) whose static meshes are joined; the joined meshes are added to the same parents
     keep   meshes for which it returns true are left alone (moving parts, hinged doors …)
     fixed  materials that change later and must keep their identity */
(function (root) {
  function autoMerge(top, opt) {
    const o = opt || {}, CELL = o.cell || 8, keep = o.keep || (() => false), fixed = new Set(o.fixed || []);
    const infoId = new Map(), bucket = new Map(), canon = new Map();
    const hx = c => c ? c.getHexString() : '', id = t => t ? t.uuid : '';
    const plain = (m, k) => m[k] === THREE.Material.prototype[k] || (root.MICRO && (m[k] === root.MICRO || m[k] === root.MICRO.key));
    const canonical = m => {
      if (fixed.has(m)) return m;
      const k = [m.type, hx(m.color), hx(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.envMapIntensity, m.side, m.flatShading,
        m.vertexColors, m.opacity, m.alphaTest, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.depthWrite, m.depthTest,
        m.wireframe, m.fog, id(m.map), id(m.normalMap), id(m.roughnessMap), id(m.metalnessMap), id(m.bumpMap), m.bumpScale, id(m.aoMap),
        id(m.emissiveMap), id(m.alphaMap), id(m.envMap), m.normalScale ? m.normalScale.x + ',' + m.normalScale.y : '',
        plain(m, 'onBeforeCompile') ? '' : m.uuid, plain(m, 'customProgramCacheKey') ? '' : m.uuid,
        m.userData && Object.keys(m.userData).length ? m.uuid : ''].join('|');
      let c = canon.get(k); if (!c) { c = m; canon.set(k, m); } return c;
    };
    const okMat = m => m && m.isMeshStandardMaterial && !m.transparent;
    const ok = m => m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && m.visible && !keep(m)
      && m.material && (Array.isArray(m.material) ? m.material.every(okMat) : okMat(m.material)) && !m.customDepthMaterial
      && m.geometry && m.geometry.isBufferGeometry && m.geometry.attributes.position && m.geometry.attributes.normal
      && !Object.keys(m.geometry.morphAttributes || {}).length && !m.children.length
      && m.onBeforeRender === THREE.Object3D.prototype.onBeforeRender;
    const list = [];
    top.updateMatrixWorld(true);
    top.traverse(m => { if (ok(m)) list.push(m); });
    const c = new THREE.Vector3();
    list.forEach(m => {
      const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      c.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld);
      const info = m.userData.info || null; if (info && !infoId.has(info)) infoId.set(info, infoId.size + 1);
      const total = g.index ? g.index.count : g.attributes.position.count;
      const ranges = Array.isArray(m.material)
        ? (g.groups || []).map(r => ({mat: m.material[r.materialIndex], start: r.start, count: Math.min(r.count, total - r.start)}))
        : [{mat: m.material, start: 0, count: total}];
      ranges.forEach(r => {
        if (!r.mat || r.count <= 0) return;
        const mat = canonical(r.mat);
        const key = [m.parent.uuid, mat.uuid, info ? infoId.get(info) : 0, m.castShadow ? 1 : 0, m.receiveShadow ? 1 : 0,
          Math.floor(c.x / CELL), Math.floor(c.z / CELL), g.attributes.color ? 1 : 0].join('|');
        let b = bucket.get(key); if (!b) { b = {mat, parent: m.parent, parts: []}; bucket.set(key, b); }
        b.parts.push({o: m, start: r.start, count: r.count});
      });
    });
    const nm = new THREE.Matrix3(), v = new THREE.Vector3(), inv = new THREE.Matrix4(), mw = new THREE.Matrix4();
    let joined = 0, made = 0; const gone = new Map();
    bucket.forEach(({mat, parent, parts}) => {
      const lone = parts.length < 2 && !Array.isArray(parts[0].o.material);
      parts.forEach(q => gone.set(q.o, (gone.has(q.o) ? gone.get(q.o) : true) && !lone));
      if (lone) return;                                             // a single single-material mesh stays as it is
      let nv = 0, ni = 0; const col = !!parts[0].o.geometry.attributes.color;
      parts.forEach(q => { nv += q.o.geometry.attributes.position.count; ni += q.count; });
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), clr = col ? new Float32Array(nv * 3) : null;
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      inv.copy(parent.matrixWorld).invert();
      let vo = 0, io = 0;
      parts.forEach(({o: m, start, count}) => {
        const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color, n = P.count;
        mw.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mw); const flip = mw.determinant() < 0;
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(mw); pos.set([v.x, v.y, v.z], (vo + i) * 3);
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
          if (U) uv.set([U.getX(i), U.getY(i)], (vo + i) * 2);
          if (clr) clr.set([C.getX(i), C.getY(i), C.getZ(i)], (vo + i) * 3);
        }
        const I = g.index;
        for (let t = start; t < start + count; t += 3) {        // a mirrored mesh has its triangles turned back the right way
          const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, d = I ? I.getX(t + 2) : t + 2;
          idx[io++] = vo + a; idx[io++] = vo + (flip ? d : b); idx[io++] = vo + (flip ? b : d);
        }
        vo += n;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); if (clr) g.setAttribute('color', new THREE.BufferAttribute(clr, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
      const o0 = parts[0].o, mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = o0.castShadow; mesh.receiveShadow = o0.receiveShadow; mesh.renderOrder = o0.renderOrder;
      mesh.userData = Object.assign({}, o0.userData, {merged: true, parts: parts.length});
      parent.add(mesh);
      joined += parts.length; made++;
    });
    // a mesh leaves the scene only when every one of its parts went into a joined mesh
    gone.forEach((all, m) => { if (all && m.parent) m.parent.remove(m); });
    return {meshes: list.length, joined, made, materials: canon.size};
  }
  root.autoMerge = autoMerge;
})(window);
