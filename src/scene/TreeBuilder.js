/**
 * 3D 碎钻粒子圣诞树主体 + 隐形深度遮挡核 + 细闪流光螺旋金带 + 璀璨星芒层
 * --------------------------------------------------
 * 核心设计：
 * 1. 经典 6 层饱满伞裙锯齿轮廓：每层从上一层下摆内侧顺滑凹弧外张，并在底边收出尖锐垂坠的松枝叶尖，
 *    既保持原版璀璨充盈的碎钻密度与通透质感（绝不内部发黑、绝不实体化），又呈现清晰的树叶层叠突出感；
 * 2. 五色独立宝石颗粒：深紫暗影、紫粉主钻、暖香槟金钻、银白珍珠钻、冷调蓝紫星屑颗颗分明；
 * 3. 纯圆滑圆锥螺旋金带 + 收窄隐形树芯遮挡锥（colorWrite: false）：
 *    金带紧贴饱满伞裙外缘顺滑盘旋，叶尖轻盈探出丝带边缘；隐形遮挡锥挡住树背面丝带同时保留层次；
 * 4. GPU 粒子雾霾爆发 + 两阶段环绕汇聚动画：全黑聚光爆开成漫天粒子雾霾，随后先自上而下凝聚成流光金带，
 *    剩余粒子继续大尺度环绕旋涡向心聚拢塑成璀璨碎钻圣诞树。
 */

import * as THREE from 'three';

const TREE_HEIGHT = 10.35;
const TREE_BASE_Y = -4.18;
const TREE_BASE_RADIUS = 3.62;
const TIER_COUNT = 6;
const FROND_COUNTS = [9, 9, 8, 8, 7, 6];

function createSeededRandom(seed = 20261225) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getOuterEnvelope(t) {
  const tc = THREE.MathUtils.clamp(t, 0, 1);
  return Math.pow(1.0 - tc, 0.96) * TREE_BASE_RADIUS + 0.04;
}

/**
 * 连续 6 层凹弧伞裙 + 尖锐锯齿垂边轮廓函数
 */
function getTreeProfile(t, angle) {
  const tc = THREE.MathUtils.clamp(t, 0, 1);
  const tierPos = tc * TIER_COUNT;
  const tierIdx = Math.min(TIER_COUNT - 1, Math.floor(tierPos));
  const u = tierPos - tierIdx;

  const flare = Math.pow(1.0 - u, 1.48);
  const frondCount = FROND_COUNTS[tierIdx];
  const tierPhase = tierIdx * 1.18;

  const rawWave = 0.5 + 0.5 * Math.cos(angle * frondCount + tierPhase);
  const leafPoint = Math.pow(rawWave, 1.75);
  const subWave = 0.5 + 0.5 * Math.cos(angle * (frondCount * 2) - tierPhase * 1.3 + 0.7);
  const subLeaf = Math.pow(subWave, 2.2) * 0.22;

  let radiusFactor;
  if (tierIdx === TIER_COUNT - 1) {
    const capFlare = Math.pow(1.0 - u, 1.25);
    radiusFactor = 0.76 + 0.26 * capFlare + capFlare * (0.20 * leafPoint + 0.05 * subLeaf);
  } else {
    const baseSkirt = 0.60 + 0.34 * flare;
    const tipScale = tierIdx === 0 ? 0.80 : 1.0;
    const tipProtrusion = flare * tipScale * (0.19 * leafPoint + 0.045 * subLeaf);
    radiusFactor = baseSkirt + tipProtrusion;
  }

  const tierDroopMult = tierIdx === 0 ? 0.68 : 1.0;
  const droopScale = 0.44 * (1.0 - tc * 0.62) * tierDroopMult;
  const yDroop = flare * droopScale * (0.28 + 0.72 * leafPoint);

  const underShadow = THREE.MathUtils.smoothstep(u, 0.70, 1.0);
  const tierShade = 0.90 + 0.20 * flare + 0.08 * leafPoint * flare - 0.24 * underShadow;

  return {
    radius: getOuterEnvelope(tc) * radiusFactor,
    yDroop,
    tierShade,
    tierIdx,
    u,
    leafPoint
  };
}

/**
 * 为开场“粒子雾霾”生成多层次 3D 星尘散落云区坐标
 */
function createHazeCloudPosition(rng = Math.random) {
  const band = rng();
  let r;
  let y;
  if (band < 0.45) {
    // 45% 庭院中近景浓密微雾星云
    r = 4.2 + rng() * 7.3;
    y = -3.0 + rng() * 12.2;
  } else if (band < 0.8) {
    // 35% 环绕雪谷的宽广银河雾霾带
    r = 11.5 + rng() * 8.0;
    y = -2.4 + rng() * 14.4;
  } else {
    // 20% 高空璀璨星云顶幕
    r = 2.5 + rng() * 11.5;
    y = 5.2 + rng() * 8.6;
  }
  const angle = rng() * Math.PI * 2;
  return [Math.cos(angle) * r, y, Math.sin(angle) * r];
}

const TREE_ORBIT_CONVERGE_GLSL = /* glsl */ `
  vReveal = 1.0;
  vec3 pos = position;
  float convEase = 1.0;
  if (uTreeGather < 0.999 || uBurst < 0.999) {
    float burstEase = 1.0 - pow(1.0 - clamp(uBurst, 0.0, 1.0), 3.0);
    float startP = (1.0 - aHeight) * 0.36 + aDelay * 0.32;
    float localP = clamp((uTreeGather - startP) / 0.42, 0.0, 1.0);
    convEase = localP * localP * (3.0 - 2.0 * localP);

    vec3 seedCenter = vec3(0.0, 2.2, 0.0);
    vec3 burstPos = mix(seedCenter, aHazePos, burstEase);
    float driftAng = uTime * 0.24 * (1.0 - convEase);
    float cd = cos(driftAng);
    float sd = sin(driftAng);
    vec3 hazeSwirl = vec3(
      burstPos.x * cd - burstPos.z * sd,
      burstPos.y + sin(uTime * 1.4 + aPhase) * 0.28 * (1.0 - convEase),
      burstPos.x * sd + burstPos.z * cd
    );

    float orbitSwirl = (1.0 - convEase) * 4.4 * smoothstep(0.0, 0.45, localP);
    float cs = cos(orbitSwirl);
    float sn = sin(orbitSwirl);
    vec3 mixed = mix(hazeSwirl, position, convEase);
    pos = vec3(
      mixed.x * cs - mixed.z * sn,
      mixed.y,
      mixed.x * sn + mixed.z * cs
    );

    float igniteFlash = exp(-pow((localP - 0.86) * 6.5, 2.0)) * 0.55 * step(0.01, localP) * step(localP, 0.99);
    vReveal = mix(0.82, 1.0, convEase) * uHazeAlpha + igniteFlash;
  }
`;

const RIBBON_ORBIT_CONVERGE_GLSL = /* glsl */ `
  vReveal = 1.0;
  vHazeMix = 0.0;
  vec3 pos = position;
  float convEase = 1.0;
  if (uRibbonGather < 0.999 || uBurst < 0.999) {
    float burstEase = 1.0 - pow(1.0 - clamp(uBurst, 0.0, 1.0), 3.0);
    float order = 1.0 - aHeight;
    float localP = clamp((uRibbonGather - order * 0.68) / 0.32, 0.0, 1.0);
    convEase = localP * localP * (3.0 - 2.0 * localP);
    vHazeMix = 1.0 - convEase;

    vec3 seedCenter = vec3(0.0, 2.2, 0.0);
    vec3 burstPos = mix(seedCenter, aHazePos, burstEase);
    float driftAng = uTime * 0.26 * (1.0 - convEase);
    float cd = cos(driftAng);
    float sd = sin(driftAng);
    vec3 hazeSwirl = vec3(
      burstPos.x * cd - burstPos.z * sd,
      burstPos.y + sin(uTime * 1.5 + aPhase) * 0.25 * (1.0 - convEase),
      burstPos.x * sd + burstPos.z * cd
    );

    float swirl = (1.0 - convEase) * 2.8 * smoothstep(0.0, 0.35, localP);
    float cs = cos(swirl);
    float sn = sin(swirl);
    vec3 mixed = mix(hazeSwirl, position, convEase);
    pos = vec3(
      mixed.x * cs - mixed.z * sn,
      mixed.y,
      mixed.x * sn + mixed.z * cs
    );

    float headFlare = exp(-pow((localP - 0.84) * 7.0, 2.0)) * 0.72 * step(0.01, localP) * step(localP, 0.99);
    vReveal = mix(0.75, 1.0, convEase) * uHazeAlpha + headFlare;
  }
`;

const TREE_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aRole;
  attribute float aShade;
  attribute vec3 aHazePos;
  attribute float aHeight;
  attribute float aDelay;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBurst;
  uniform float uHazeAlpha;
  uniform float uTreeGather;
  uniform float uBeat;

  varying float vRole;
  varying float vShade;
  varying float vTwinkle;
  varying float vReveal;

  void main() {
    vRole = aRole;
    vShade = aShade;

    float speed = aRole > 1.5 ? 3.1 : 1.9;
    float wave = 0.5 + 0.5 * sin(uTime * speed + aPhase);
    vTwinkle = aRole > 1.5 ? mix(0.68, 1.24, pow(wave, 1.6)) : mix(0.75, 1.08, wave);
    if (aRole > 0.5) {
      vTwinkle += uBeat * (aRole > 1.5 ? 0.28 : 0.14) * (0.45 + 0.55 * sin(aPhase + uTime * 2.2));
    }

    ${TREE_ORBIT_CONVERGE_GLSL}
    if (uTreeGather < 0.999 || uBurst < 0.999) {
      if (aRole < 0.5 && convEase < 0.18) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        return;
      }
      if (aRole < 0.5) {
        vReveal *= smoothstep(0.18, 0.75, convEase);
      }
    }
    pos.y += sin(uTime * 0.85 + aPhase) * 0.014 * convEase;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float beatSize = aRole > 0.5 ? (1.0 + uBeat * (aRole > 1.5 ? 0.14 : 0.06)) : 1.0;
    float rawSize = aSize * beatSize * mix(0.68, 1.0, convEase) * uPixelRatio * (92.0 / max(-mvPosition.z, 1.0));
    gl_PointSize = min(rawSize, 13.5 * uPixelRatio);
  }
`;

const TREE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorDeep;
  uniform vec3 uRibbonColor;

  varying float vRole;
  varying float vShade;
  varying float vTwinkle;
  varying float vReveal;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.46) discard;

    float rim = smoothstep(0.46, 0.05, dist);

    vec3 baseColor;
    if (vRole < 0.5) {
      baseColor = uColorDeep;
    } else if (vRole < 1.5) {
      baseColor = uColorPrimary;
    } else if (vRole < 2.5) {
      baseColor = mix(uRibbonColor, vec3(1.0, 0.92, 0.68), 0.25);
    } else if (vRole < 3.5) {
      baseColor = mix(uColorSecondary, vec3(0.98, 0.99, 1.0), 0.5);
    } else {
      baseColor = mix(uColorPrimary, vec3(0.56, 0.68, 0.98), 0.58);
    }

    vec3 litColor = baseColor * (0.42 + 0.68 * rim) * vShade * vTwinkle * vReveal;
    gl_FragColor = vec4(litColor, 1.0);
  }
`;

const SPARKLE_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aGoldMix;
  attribute vec3 aHazePos;
  attribute float aHeight;
  attribute float aDelay;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBurst;
  uniform float uHazeAlpha;
  uniform float uTreeGather;
  uniform float uBeat;

  varying float vFlash;
  varying float vGoldMix;
  varying float vReveal;

  void main() {
    vGoldMix = aGoldMix;
    float wave = 0.5 + 0.5 * sin(uTime * 3.4 + aPhase);
    vFlash = mix(0.22, 1.32, pow(wave, 2.4)) + uBeat * 0.42;

    ${TREE_ORBIT_CONVERGE_GLSL}

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float rawSize = aSize * (0.76 + 0.38 * wave) * (1.0 + uBeat * 0.26) * mix(1.35, 1.0, convEase) * uPixelRatio * (150.0 / max(-mvPosition.z, 1.0));
    gl_PointSize = min(rawSize, 24.0 * uPixelRatio);
  }
`;

const SPARKLE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorSecondary;
  uniform vec3 uRibbonColor;
  varying float vFlash;
  varying float vGoldMix;
  varying float vReveal;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float crossH = exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 4.6);
    float crossV = exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 4.6);
    float core = exp(-dist * 11.0);
    float alpha = clamp(core + (crossH + crossV) * 0.8, 0.0, 1.0);

    vec3 tint = mix(uColorSecondary, uRibbonColor, vGoldMix);
    vec3 color = mix(tint, vec3(1.0, 0.99, 1.0), 0.45);
    gl_FragColor = vec4(color * vFlash * vReveal, alpha * 0.68);
  }
`;

const RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aHazePos;
  attribute float aHeight;
  attribute float aCenter;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBurst;
  uniform float uHazeAlpha;
  uniform float uRibbonGather;
  uniform float uBeat;

  varying float vGlow;
  varying float vCenter;
  varying float vReveal;
  varying float vHazeMix;

  void main() {
    vCenter = aCenter;
    float flow = 0.5 + 0.5 * sin(aHeight * 24.0 - uTime * 2.4 + aPhase * 0.3);
    float twinkle = 0.72 + 0.34 * sin(uTime * 3.8 + aPhase);
    vGlow = mix(0.8, 1.24, flow) * twinkle * (1.0 + uBeat * 0.22);

    ${RIBBON_ORBIT_CONVERGE_GLSL}

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (0.9 + 0.18 * flow) * mix(1.85, 1.0, convEase) * uPixelRatio * (90.0 / max(-mvPosition.z, 1.0));
  }
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uRibbonColor;
  uniform float uHazeAlpha;
  varying float vGlow;
  varying float vCenter;
  varying float vReveal;
  varying float vHazeMix;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    // 柔羽化星尘颗粒：未归位时呈现柔美粒子雾霾薄纱，归位后化作璀璨香槟金流光灯带
    float soft = pow(smoothstep(0.5, 0.04, dist), 1.85);
    vec3 goldCore = mix(uRibbonColor, vec3(1.0, 0.98, 0.88), vCenter * 0.55);
    float hazeSoft = mix(1.0, 0.45, vHazeMix);
    float alpha = soft * (0.34 + 0.54 * vCenter) * mix(0.35, 1.0, min(vReveal, 1.0)) * hazeSoft * uHazeAlpha;
    gl_FragColor = vec4(goldCore * vGlow * vReveal, alpha);
  }
`;

export class TreeBuilder {
  constructor(colors, isMobile = false) {
    this.group = new THREE.Group();
    this.particleCount = isMobile ? 15500 : 21500;
    this.sparkleCount = isMobile ? 1400 : 2000;
    this.ribbonCount = isMobile ? 5200 : 7600;
    this.ribbonEnabled = true;

    this.rng = createSeededRandom(20261225);

    const pr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    this.treeUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: pr },
      uBurst: { value: 1.0 },
      uHazeAlpha: { value: 1.0 },
      uTreeGather: { value: 1.0 },
      uBeat: { value: 0 },
      uColorPrimary: { value: new THREE.Color(colors.treePrimary) },
      uColorSecondary: { value: new THREE.Color(colors.treeSecondary) },
      uColorDeep: { value: new THREE.Color(colors.treeDeep) },
      uRibbonColor: { value: new THREE.Color(colors.ribbonColor) }
    };

    this.sparkleUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: pr },
      uBurst: { value: 1.0 },
      uHazeAlpha: { value: 1.0 },
      uTreeGather: { value: 1.0 },
      uBeat: { value: 0 },
      uColorSecondary: { value: new THREE.Color(colors.treeSecondary) },
      uRibbonColor: { value: new THREE.Color(colors.ribbonColor) }
    };

    this.ribbonUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: pr },
      uBurst: { value: 1.0 },
      uHazeAlpha: { value: 1.0 },
      uRibbonGather: { value: 1.0 },
      uBeat: { value: 0 },
      uRibbonColor: { value: new THREE.Color(colors.ribbonColor) }
    };

    this.treeMesh = this._buildTreeParticles();
    this.treeMesh.renderOrder = 1;

    // 隐形树芯深度遮挡锥：严格缩在 0.60 颈部以内，干净遮挡背面金带同时保留前层伞裙充盈感
    this.depthCone = this._buildDepthOccluderCone();
    this.depthCone.renderOrder = 2;

    this.ribbonMesh = this._buildRibbonParticles();
    this.ribbonMesh.renderOrder = 3;

    this.sparkleMesh = this._buildSparkleParticles();
    this.sparkleMesh.renderOrder = 4;

    this.group.add(this.treeMesh);
    this.group.add(this.depthCone);
    this.group.add(this.ribbonMesh);
    this.group.add(this.sparkleMesh);
  }

  _buildDepthOccluderCone() {
    const geo = new THREE.ConeGeometry(TREE_BASE_RADIUS * 0.58, TREE_HEIGHT * 0.95, 40, 1, false);
    const mat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = TREE_BASE_Y + TREE_HEIGHT * 0.475;
    return mesh;
  }

  _buildTreeParticles() {
    const rng = this.rng;
    const count = this.particleCount;
    const positions = new Float32Array(count * 3);
    const hazePositions = new Float32Array(count * 3);
    const heights = new Float32Array(count);
    const delays = new Float32Array(count);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const roles = new Float32Array(count);
    const shades = new Float32Array(count);

    // 各层边缘加强采样权重（按周长/面积分布，底层略多、顶层略少）
    const tierWeights = [];
    let totalTierWeight = 0;
    for (let k = 0; k < TIER_COUNT; k += 1) {
      const w = getOuterEnvelope((k + 0.12) / TIER_COUNT);
      totalTierWeight += w;
      tierWeights.push(totalTierWeight);
    }
    const pickWeightedTier = () => {
      const target = rng() * totalTierWeight;
      for (let k = 0; k < TIER_COUNT; k += 1) {
        if (target <= tierWeights[k]) return k;
      }
      return TIER_COUNT - 1;
    };

    const pickBrightGem = (i, baseSizeMin = 0.45, baseSizeSpan = 0.56) => {
      const p = rng();
      if (p < 0.42) {
        roles[i] = 1.0;
        sizes[i] = baseSizeMin + rng() * baseSizeSpan;
      } else if (p < 0.67) {
        roles[i] = 2.0;
        sizes[i] = baseSizeMin + 0.03 + rng() * (baseSizeSpan + 0.04);
      } else if (p < 0.88) {
        roles[i] = 3.0;
        sizes[i] = baseSizeMin - 0.02 + rng() * baseSizeSpan;
      } else {
        roles[i] = 4.0;
        sizes[i] = baseSizeMin + rng() * (baseSizeSpan - 0.04);
      }
    };

    const shellEnd = Math.floor(count * 0.70);
    const edgeEnd = Math.floor(count * 0.86);

    for (let i = 0; i < count; i += 1) {
      let x = 0;
      let y = TREE_BASE_Y;
      let z = 0;

      if (i < shellEnd) {
        // 1. 70% 饱满外层伞裙碎钻壳（连续无空洞，充盈感十足）
        const t = 1.0 - Math.pow(rng(), 0.58);
        const angle = rng() * Math.PI * 2;
        const profile = getTreeProfile(t, angle);
        const rFactor = 0.78 + 0.22 * Math.pow(rng(), 0.42);
        const r = profile.radius * rFactor;

        x = Math.cos(angle) * r;
        y = TREE_BASE_Y + t * TREE_HEIGHT - profile.yDroop + (rng() - 0.5) * 0.08;
        z = Math.sin(angle) * r;

        if (profile.u > 0.78) {
          shades[i] = THREE.MathUtils.clamp(profile.tierShade * (0.86 + 0.16 * rFactor), 0.56, 0.88);
          roles[i] = rng() < 0.32 ? 0.0 : 1.0;
          sizes[i] = 0.42 + rng() * 0.48;
        } else {
          shades[i] = THREE.MathUtils.clamp(profile.tierShade * (0.86 + 0.20 * rFactor), 0.74, 1.18);
          pickBrightGem(i, 0.45, 0.56);
        }
      } else if (i < edgeEnd) {
        // 2. 16% 锯齿边缘叶尖强化层（聚焦各层下摆尖角与叶缘弧线，勾勒清晰锯齿剪影）
        const tierIdx = pickWeightedTier();
        const u = Math.pow(rng(), 2.3) * 0.34;
        const t = (tierIdx + u) / TIER_COUNT;
        const frondCount = FROND_COUNTS[tierIdx];
        const tierPhase = tierIdx * 1.18;
        const peakIdx = Math.floor(rng() * frondCount);
        const peakAngle = (2 * Math.PI * peakIdx - tierPhase) / frondCount;
        const delta = (rng() + rng() - 1.0) * (Math.PI / frondCount) * 0.65;
        const angle = peakAngle + delta;

        const profile = getTreeProfile(t, angle);
        const rFactor = 0.92 + 0.08 * rng();
        const r = profile.radius * rFactor;

        x = Math.cos(angle) * r;
        y = TREE_BASE_Y + t * TREE_HEIGHT - profile.yDroop + (rng() - 0.5) * 0.05;
        z = Math.sin(angle) * r;

        shades[i] = 0.96 + rng() * 0.22;
        const p = rng();
        if (p < 0.38) roles[i] = 1.0;
        else if (p < 0.66) roles[i] = 2.0;
        else if (p < 0.90) roles[i] = 3.0;
        else roles[i] = 4.0;
        sizes[i] = 0.42 + rng() * 0.48;
      } else {
        // 3. 14% 柔和充盈内芯层（主色为主、绝不发黑，托起整体丰满感）
        const t = 1.0 - Math.pow(rng(), 0.60);
        const angle = rng() * Math.PI * 2;
        const profile = getTreeProfile(t, angle);
        const rFactor = 0.26 + 0.52 * Math.pow(rng(), 0.70);
        const r = profile.radius * rFactor;

        x = Math.cos(angle) * r;
        y = TREE_BASE_Y + t * TREE_HEIGHT - profile.yDroop * 0.65 + (rng() - 0.5) * 0.1;
        z = Math.sin(angle) * r;

        shades[i] = THREE.MathUtils.clamp(0.48 + 0.30 * rFactor, 0.46, 0.78);
        roles[i] = rng() < 0.35 ? 0.0 : 1.0;
        sizes[i] = 0.42 + rng() * 0.46;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const [hx, hy, hz] = createHazeCloudPosition(rng);
      hazePositions[i * 3] = hx;
      hazePositions[i * 3 + 1] = hy;
      hazePositions[i * 3 + 2] = hz;

      heights[i] = THREE.MathUtils.clamp((y - TREE_BASE_Y) / TREE_HEIGHT, 0, 1);
      delays[i] = rng() * 0.3;
      phases[i] = rng() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aHazePos', new THREE.BufferAttribute(hazePositions, 3));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aRole', new THREE.BufferAttribute(roles, 1));
    geometry.setAttribute('aShade', new THREE.BufferAttribute(shades, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.treeUniforms,
      vertexShader: TREE_VERTEX_SHADER,
      fragmentShader: TREE_FRAGMENT_SHADER,
      transparent: false,
      depthTest: true,
      depthWrite: true
    });

    return new THREE.Points(geometry, material);
  }

  _buildSparkleParticles() {
    const rng = this.rng;
    const count = this.sparkleCount;
    const positions = new Float32Array(count * 3);
    const hazePositions = new Float32Array(count * 3);
    const heights = new Float32Array(count);
    const delays = new Float32Array(count);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const goldMixes = new Float32Array(count);

    const surfaceSplit = Math.floor(count * 0.65);

    for (let i = 0; i < count; i += 1) {
      let x = 0;
      let y = TREE_BASE_Y;
      let z = 0;

      if (i < surfaceSplit) {
        // 65% 星芒贴合 6 层伞裙外表面
        const t = 1.0 - Math.pow(rng(), 0.6);
        const angle = rng() * Math.PI * 2;
        const profile = getTreeProfile(t, angle);
        const r = profile.radius * (0.97 + rng() * 0.05) + 0.02;
        x = Math.cos(angle) * r;
        y = TREE_BASE_Y + t * TREE_HEIGHT - profile.yDroop + (rng() - 0.5) * 0.08;
        z = Math.sin(angle) * r;
      } else {
        // 35% 星芒点缀每层锯齿下摆叶尖
        const tierIdx = Math.floor(rng() * TIER_COUNT);
        const u = Math.pow(rng(), 2.0) * 0.22;
        const t = (tierIdx + u) / TIER_COUNT;
        const frondCount = FROND_COUNTS[tierIdx];
        const tierPhase = tierIdx * 1.18;
        const peakIdx = Math.floor(rng() * frondCount);
        const peakAngle = (2 * Math.PI * peakIdx - tierPhase) / frondCount;
        const angle = peakAngle + (rng() - 0.5) * (Math.PI / frondCount) * 0.45;
        const profile = getTreeProfile(t, angle);
        const r = profile.radius * (0.97 + rng() * 0.05) + 0.02;
        x = Math.cos(angle) * r;
        y = TREE_BASE_Y + t * TREE_HEIGHT - profile.yDroop + (rng() - 0.5) * 0.05;
        z = Math.sin(angle) * r;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const [hx, hy, hz] = createHazeCloudPosition(rng);
      hazePositions[i * 3] = hx;
      hazePositions[i * 3 + 1] = hy;
      hazePositions[i * 3 + 2] = hz;

      heights[i] = THREE.MathUtils.clamp((y - TREE_BASE_Y) / TREE_HEIGHT, 0, 1);
      delays[i] = rng() * 0.3;

      const isHeroStar = rng() < 0.07;
      sizes[i] = isHeroStar ? 1.95 + rng() * 1.0 : 0.92 + rng() * 0.92;
      phases[i] = rng() * Math.PI * 2;
      goldMixes[i] = rng() < 0.48 ? 0.85 : 0.1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aHazePos', new THREE.BufferAttribute(hazePositions, 3));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aGoldMix', new THREE.BufferAttribute(goldMixes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.sparkleUniforms,
      vertexShader: SPARKLE_VERTEX_SHADER,
      fragmentShader: SPARKLE_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  _buildRibbonParticles() {
    const rng = this.rng;
    const count = this.ribbonCount;
    const positions = new Float32Array(count * 3);
    const hazePositions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const heights = new Float32Array(count);
    const centers = new Float32Array(count);

    // 4.6 圈纯圆滑圆锥螺旋线：紧密贴合 6 层饱满伞裙外缘，让锯齿叶尖轻盈探出丝带边缘
    const turns = 4.6;

    for (let i = 0; i < count; i += 1) {
      const u = rng();
      const t = 0.055 + (1.0 - Math.pow(u, 0.68)) * 0.91;

      const baseAngle = t * Math.PI * 2.0 * turns;
      const angle = baseAngle + (rng() - 0.5) * 0.07;

      const spread = (rng() + rng() + rng()) / 1.5 - 1.0;
      const halfWidth = 0.22 - 0.1 * t;
      const bandOffset = spread * halfWidth;

      const smoothCone = getOuterEnvelope(t);
      const radialScatter = (rng() - 0.5) * 0.09;
      const r = smoothCone * 1.02 + 0.05 + radialScatter;
      const y = TREE_BASE_Y + t * TREE_HEIGHT + bandOffset;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const [hx, hy, hz] = createHazeCloudPosition(rng);
      hazePositions[i * 3] = hx;
      hazePositions[i * 3 + 1] = hy;
      hazePositions[i * 3 + 2] = hz;

      const centerFactor = Math.max(0, 1.0 - Math.abs(spread));
      centers[i] = centerFactor;
      sizes[i] = 0.34 + centerFactor * 0.42 + rng() * 0.32;
      phases[i] = rng() * Math.PI * 2;
      heights[i] = t;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aHazePos', new THREE.BufferAttribute(hazePositions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.ribbonUniforms,
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * 分别控制：爆开扩散（burst）、粒子雾霾显现（hazeAlpha）、灯带由上往下凝聚（ribbonGather）、剩余粒子环绕成树（treeGather）
   */
  setIntroProgress(burst, hazeAlpha, ribbonGather, treeGather) {
    const b = Math.min(1, Math.max(0, burst));
    const ha = Math.min(1, Math.max(0, hazeAlpha));
    const rg = Math.min(1, Math.max(0, ribbonGather));
    const tg = Math.min(1, Math.max(0, treeGather));

    this.treeUniforms.uBurst.value = b;
    this.treeUniforms.uHazeAlpha.value = ha;
    this.treeUniforms.uTreeGather.value = tg;

    this.sparkleUniforms.uBurst.value = b;
    this.sparkleUniforms.uHazeAlpha.value = ha;
    this.sparkleUniforms.uTreeGather.value = tg;

    this.ribbonUniforms.uBurst.value = b;
    this.ribbonUniforms.uHazeAlpha.value = ha;
    this.ribbonUniforms.uRibbonGather.value = rg;

    const showParticles = b > 0.002 && ha > 0.002;
    this.treeMesh.visible = showParticles;
    this.sparkleMesh.visible = showParticles;
    this.ribbonMesh.visible = this.ribbonEnabled && showParticles;
    // 粒子雾霾悬停与环绕阶段关闭树芯隐形遮挡锥；圣诞树凝实后开启遮挡背面丝带
    this.depthCone.visible = tg >= 0.72;
  }

  /**
   * 兼容快捷入口：同步设置所有开场阶段进度 [0, 1]
   */
  setAssemble(value) {
    this.setIntroProgress(value, value, value, value);
  }

  /**
   * 同步八音盒实时节拍能量 [0, 1]，驱动碎钻与丝带随音乐律动闪烁
   */
  setBeat(beat) {
    this.treeUniforms.uBeat.value = beat;
    this.sparkleUniforms.uBeat.value = beat;
    this.ribbonUniforms.uBeat.value = beat;
  }

  setColors(colors) {
    this.treeUniforms.uColorPrimary.value.set(colors.treePrimary);
    this.treeUniforms.uColorSecondary.value.set(colors.treeSecondary);
    this.treeUniforms.uColorDeep.value.set(colors.treeDeep);
    this.treeUniforms.uRibbonColor.value.set(colors.ribbonColor);
    this.sparkleUniforms.uColorSecondary.value.set(colors.treeSecondary);
    this.sparkleUniforms.uRibbonColor.value.set(colors.ribbonColor);
    this.ribbonUniforms.uRibbonColor.value.set(colors.ribbonColor);
  }

  setRibbonVisible(visible) {
    this.ribbonEnabled = Boolean(visible);
    const showParticles =
      this.ribbonUniforms.uBurst.value > 0.002 && this.ribbonUniforms.uHazeAlpha.value > 0.002;
    this.ribbonMesh.visible = this.ribbonEnabled && showParticles;
  }

  setPixelRatio(ratio) {
    this.treeUniforms.uPixelRatio.value = ratio;
    this.sparkleUniforms.uPixelRatio.value = ratio;
    this.ribbonUniforms.uPixelRatio.value = ratio;
  }

  update(elapsed) {
    this.treeUniforms.uTime.value = elapsed;
    this.sparkleUniforms.uTime.value = elapsed;
    this.ribbonUniforms.uTime.value = elapsed;
  }
}
