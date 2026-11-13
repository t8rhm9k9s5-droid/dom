/* Demo scene: a street of procedural houses under the real sun of the chosen moment.
   It shows the three parts of the engine at work: the houses (house.js), the micro-detail on every material (micro.js) and the
   static merge (merge.js) — the panel shows how many meshes were joined and how many draw calls a frame costs. */
(function () {
  const LAT = 55.75, LON = 37.62;                               // a demo place: central Moscow
  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.2, 2000);
  camera.position.set(-18, 14, -26);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(14, 2, 6); controls.maxPolarAngle = Math.PI * 0.49; controls.enableDamping = true; controls.update();

  // sky and light
  const sky = new THREE.Sky(); sky.scale.setScalar(1000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 3; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.8;
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5b6340, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target); sun.target.position.set(14, 0, 6);

  // ground: lawn, a street and a pavement
  const G = new THREE.Group(); scene.add(G);
  const flat = (x1, z1, x2, z2, y, m) => { const g = new THREE.PlaneGeometry(x2 - x1, z2 - z1); g.rotateX(-Math.PI / 2); g.translate((x1 + x2) / 2, y, (z1 + z2) / 2);
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; G.add(mesh); };
  flat(-200, -200, 200, 200, 0, House.std(0x6f8a45, {roughness: 1}));
  flat(-60, -14, 90, -7, 0.01, House.std(0x4a4d52, {roughness: 0.95}));
  flat(-60, -7, 90, -5, 0.02, House.std(0x9b978f));

  // a row of houses, each a little different
  const bricks = [House.brick([142, 70, 54], 21), House.brick([196, 114, 64], 23), House.brick([226, 209, 172], 25), House.brick([158, 92, 62], 27)];
  const roofs = [0x5a3a2c, 0x3f6b45, 0x4a4f55, 0x6b3328].map(c => House.std(c, {roughness: 0.5, metalness: 0.3}));
  const H = new THREE.Group(); scene.add(H);
  [[0, 2], [16, 1], [30, 2], [44, 2], [-14, 1]].forEach(([x, st], k) =>
    House.build(H, {x1: x, z1: 0, x2: x + 10, z2: 9 + (k % 2), storeys: st, wall: bricks[k % 4], roof: roofs[(k + 1) % 4],
      info: {t: 'Дом ' + (k + 1), d: st + ' эт., кирпич'}}));
  const before = (() => { let n = 0; scene.traverse(o => { if (o.isMesh) n++; }); return n; })();
  const merge = autoMerge(H, {cell: 8});

  // the moment: today, the hour from the slider
  const hour = document.getElementById('hour'), hourOut = document.getElementById('hourOut'), stats = document.getElementById('stats');
  const sunVec = new THREE.Vector3();
  function setTime() {
    const t = new Date(); t.setHours(0, 0, 0, 0); t.setMinutes(Math.round(+hour.value * 60));
    hourOut.textContent = t.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    const p = Sun.sun(t, LAT, LON), dv = Sun.dirTo(p.az, Math.max(p.alt, -4));
    sunVec.set(dv.x, dv.y, dv.z); su.sunPosition.value.copy(sunVec);
    const day = THREE.MathUtils.smoothstep(p.alt, -4, 8);
    sun.position.copy(sun.target.position).addScaledVector(sunVec, 120); sun.intensity = 2.2 * day; sun.visible = p.alt > -1;
    hemi.intensity = 0.08 + 0.5 * day; renderer.toneMappingExposure = 0.35 + 0.55 * day;
    stats.dataset.alt = p.alt.toFixed(1);
  }
  hour.addEventListener('input', setTime);
  { const n = new Date(); hour.value = n.getHours() + n.getMinutes() / 60; }
  setTime();

  function resize() { const w = app.clientWidth, h = app.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();
  let frame = 0;
  (function loop() {
    requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera);
    if (++frame % 30 === 1) stats.textContent =
      `Деталей в сцене: ${before}, из них ${merge.joined} склеены в ${merge.made} · ` +
      `вызовов отрисовки за кадр: ${renderer.info.render.calls} · треугольников: ${(renderer.info.render.triangles / 1000).toFixed(0)} тыс. · солнце ${stats.dataset.alt}°`;
  })();
  window.__demo = {scene, camera, controls, renderer, merge, before};
})();
