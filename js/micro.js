/* Micro-detail drawn by formula on the graphics card, instead of from pictures: it costs no files and no memory.
   Every plain surface gets a fine grain in its relief (2–3 cm) and slow patches of colour and gloss (weathering, sun-fading).
   The relief fades out with distance, so far surfaces do not shimmer. Surfaces with their own texture get only the colour patches;
   glossy ones (glass, polish) stay clean. One shared shader for every material: it adds no shader programs.
   Use: material.onBeforeCompile = MICRO; material.customProgramCacheKey = MICRO.key  (or MICRO.apply(material)). three.js r128. */
(function (root) {
  const MICRO = function (sh) {
    const m = this, glass = (m.roughness < 0.3 && !m.map) || m.transparent, metal = m.metalness > 0.5;
    sh.uniforms.uMicro = {value: glass ? 0 : (m.map || m.normalMap ? 0 : (metal ? 0.35 : 1.0))};
    sh.uniforms.uTint = {value: glass ? 0 : (metal ? 0.05 : 0.09)};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMicroW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 mw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nmw = instanceMatrix * mw;\n#endif\nvMicroW = (modelMatrix * mw).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vMicroW; uniform float uMicro, uTint;
float mh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float mn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(mh(i), mh(i + vec3(1,0,0)), f.x), mix(mh(i + vec3(0,1,0)), mh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mh(i + vec3(0,0,1)), mh(i + vec3(1,0,1)), f.x), mix(mh(i + vec3(0,1,1)), mh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float mPatch = mn(vMicroW*0.9) * 0.6 + mn(vMicroW*3.1) * 0.4;
diffuseColor.rgb *= 1.0 + uTint * (mPatch - 0.5) * 2.0;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * (1.0 + uTint * 1.6 * (mPatch - 0.5)), 0.04, 1.0);`)
      // the grain: a height from 3D noise turned into a bent normal by screen-space derivatives (WebGL 2 only)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#if __VERSION__ >= 300
{ float fade = uMicro * smoothstep(22.0, 5.0, length(vViewPosition));
  if (fade > 0.001){
    vec3 mQ = vMicroW * 42.0; float mH = (mn(mQ) * 0.65 + mn(mQ * 2.3) * 0.35) * 0.0016 * fade;
    vec3 mSp = -vViewPosition, mDx = dFdx(mSp), mDy = dFdy(mSp); float mHx = dFdx(mH), mHy = dFdy(mH);
    vec3 mR1 = cross(mDy, normal), mR2 = cross(normal, mDx); float mDet = dot(mDx, mR1);
    if (abs(mDet) > 1e-12){ vec3 mG = sign(mDet) * (mHx * mR1 + mHy * mR2); normal = normalize(abs(mDet) * normal - mG); } } }
#endif`);
  };
  MICRO.key = () => 'micro1';
  MICRO.apply = m => { m.onBeforeCompile = MICRO; m.customProgramCacheKey = MICRO.key; return m; };
  root.MICRO = MICRO;
})(window);
