/**
 * 3D 碎钻粒子圣诞树主体 + 隐形深度遮挡核 + 细闪流光螺旋金带 + 璀璨星芒层
 * --------------------------------------------------
 * 核心设计：
 * 1. 平滑圆润松枝波浪：使用连续正弦波塑造 8 层自然松枝起伏与明暗阴影，无生硬阶梯断层；
 * 2. 五色独立宝石颗粒：深紫暗影、紫粉主钻、暖香槟金钻、银白珍珠钻、冷调蓝紫星屑颗颗分明；
 * 3. 纯圆滑圆锥螺旋金带 + 隐形树芯遮挡锥（colorWrite: false）：
 *    金带沿纯平滑螺旋线盘旋，绝不凸起、绝不断裂；隐形遮挡锥挡住绕到树背面的丝带，同时保留树身通透星隙！
 * 4. GPU 粒子雾霾爆发 + 两阶段环绕汇聚动画：全黑聚光爆开成漫天粒子雾霾，随后先自上而下凝聚成流光金带，
 *    剩余粒子继续大尺度环绕旋涡向心聚拢塑成璀璨碎钻圣诞树。
 */

import * as THREE from 'three';

const TREE_HEIGHT = 10.5;
const TREE_BASE_Y = -4.35;
const TREE_BASE_RADIUS = 3.85;

/**
 * 连续平滑的层叠松枝轮廓函数（无 floor 阶梯跳变）
 * 返回：当前位置松枝最大半径 radius、基础圆锥包络 globalCone、以及层内受光系数 tierShade
 */
function getSmoothTreeProfile(t, angle) {
  const globalCone = Math.pow(1.0 - t, 0.91) * TREE_BASE_RADIUS + 0.06;

  // 7.5 层平滑松枝起伏（波峰对应松枝外舒下沿，波谷对应层间内收凹槽）
  const wavePhase = t * Math.PI * 2.0 * 7.5;
  const tierWave = Math.sin(wavePhase);
  const skirtFactor = 0.89 + 0.105 * tierWave * (1.0 - t * 0.28);

  // 环向柔和分叉（幅度克制，确保不会刺穿外侧螺旋金带）
  const frondCount = 7.0;
  const frondWave = 1.0 + 0.055 * Math.cos(angle * frondCount + t * 14.0) * (1.0 - t * 0.35);

  // 波峰处（松枝外翻下沿）明亮，波谷处（上一层树枝下方阴影）深邃压暗
  const tierShade = 0.72 + 0.36 * (0.5 + 0.5 * tierWave);

  return {
    radius: globalCone * skirtFactor * frondWave,
    globalCone,
    tierShade
  };
}

/**
 * 为开场“粒子雾霾”生成多层次 3D 星尘散落云区坐标
 */
function createHazeCloudPosition() {
  const band = Math.random();
  let r;
  let y;
  if (band < 0.45) {
    // 45% 庭院中近景浓密微雾星云
    r = 4.2 + Math.random() * 7.3;
    y = -3.0 + Math.random() * 12.2;
  } else if (band < 0.8) {
    // 35% 环绕雪谷的宽广银河雾霾带
    r = 11.5 + Math.random() * 8.0;
    y = -2.4 + Math.random() * 14.4;
  } else {
    // 20% 高空璀璨星云顶幕
    r = 2.5 + Math.random() * 11.5;
    y = 5.2 + Math.random() * 8.6;
  }
  const angle = Math.random() * Math.PI * 2;
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
    gl_PointSize = aSize * beatSize * mix(0.68, 1.0, convEase) * uPixelRatio * (92.0 / max(-mvPosition.z, 1.0));
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
    gl_PointSize = aSize * (0.76 + 0.38 * wave) * (1.0 + uBeat * 0.26) * mix(1.35, 1.0, convEase) * uPixelRatio * (150.0 / max(-mvPosition.z, 1.0));
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
    this.particleCount = isMobile ? 14000 : 19000;
    this.sparkleCount = isMobile ? 1300 : 1900;
    this.ribbonCount = isMobile ? 5200 : 7600;
    this.ribbonEnabled = true;

    const pr = Math.min(window.devicePixelRatio || 1, 2);

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

    // 隐形树芯深度遮挡锥：不画任何颜色（保留树身星隙通透感），只写入深度缓冲挡住树背面的螺旋丝带！
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
    const geo = new THREE.ConeGeometry(TREE_BASE_RADIUS * 0.86, TREE_HEIGHT * 0.98, 40, 1, false);
    const mat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = TREE_BASE_Y + TREE_HEIGHT * 0.49;
    return mesh;
  }

  _buildTreeParticles() {
    const count = this.particleCount;
    const positions = new Float32Array(count * 3);
    const hazePositions = new Float32Array(count * 3);
    const heights = new Float32Array(count);
    const delays = new Float32Array(count);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const roles = new Float32Array(count);
    const shades = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const u = Math.random();
      const t = 1.0 - Math.pow(u, 0.57);
      const angle = Math.random() * Math.PI * 2;
      const { radius: maxR, tierShade } = getSmoothTreeProfile(t, angle);

      const isOuter = Math.random() < 0.7;
      const rFactor = isOuter
        ? 0.76 + 0.24 * Math.pow(Math.random(), 0.48)
        : 0.22 + 0.54 * Math.random();

      const r = maxR * rFactor;
      const y = TREE_BASE_Y + t * TREE_HEIGHT + (Math.random() - 0.5) * 0.12;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const [hx, hy, hz] = createHazeCloudPosition();
      hazePositions[i * 3] = hx;
      hazePositions[i * 3 + 1] = hy;
      hazePositions[i * 3 + 2] = hz;

      heights[i] = t;
      delays[i] = Math.random() * 0.3;

      const shellLight = isOuter ? 0.8 + 0.28 * rFactor : 0.32 + 0.35 * rFactor;
      shades[i] = Math.max(0.2, tierShade * shellLight);

      const pick = Math.random();
      if (!isOuter || tierShade < 0.82) {
        roles[i] = pick < 0.65 ? 0.0 : 1.0;
        sizes[i] = 0.42 + Math.random() * 0.45;
      } else if (pick < 0.42) {
        roles[i] = 1.0;
        sizes[i] = 0.44 + Math.random() * 0.56;
      } else if (pick < 0.66) {
        roles[i] = 2.0;
        sizes[i] = 0.48 + Math.random() * 0.62;
      } else if (pick < 0.86) {
        roles[i] = 3.0;
        sizes[i] = 0.42 + Math.random() * 0.54;
      } else {
        roles[i] = 4.0;
        sizes[i] = 0.44 + Math.random() * 0.52;
      }

      phases[i] = Math.random() * Math.PI * 2;
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
    const count = this.sparkleCount;
    const positions = new Float32Array(count * 3);
    const hazePositions = new Float32Array(count * 3);
    const heights = new Float32Array(count);
    const delays = new Float32Array(count);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const goldMixes = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const t = 1.0 - Math.pow(Math.random(), 0.6);
      const angle = Math.random() * Math.PI * 2;
      const { radius: maxR } = getSmoothTreeProfile(t, angle);
      const r = maxR * (0.96 + Math.random() * 0.07) + 0.05;
      const y = TREE_BASE_Y + t * TREE_HEIGHT + (Math.random() - 0.5) * 0.1;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const [hx, hy, hz] = createHazeCloudPosition();
      hazePositions[i * 3] = hx;
      hazePositions[i * 3 + 1] = hy;
      hazePositions[i * 3 + 2] = hz;

      heights[i] = t;
      delays[i] = Math.random() * 0.3;

      const isHeroStar = Math.random() < 0.07;
      sizes[i] = isHeroStar ? 2.0 + Math.random() * 1.05 : 0.95 + Math.random() * 1.0;
      phases[i] = Math.random() * Math.PI * 2;
      goldMixes[i] = Math.random() < 0.48 ? 0.85 : 0.1;
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
    const count = this.ribbonCount;
    const positions = new Float32Array(count * 3);
    const hazePositions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const heights = new Float32Array(count);
    const centers = new Float32Array(count);

    // 4.6 圈纯圆滑圆锥螺旋线：无任何阶梯函数、无分叉扰动，线条 100% 顺滑优雅！
    const turns = 4.6;

    for (let i = 0; i < count; i += 1) {
      // 按弧长近似采样（底部周长更长分配更多星尘，确保从底到顶密度均匀不断裂）
      const u = Math.random();
      const t = 0.04 + (1.0 - Math.pow(u, 0.68)) * 0.92;

      const baseAngle = t * Math.PI * 2.0 * turns;
      const angle = baseAngle + (Math.random() - 0.5) * 0.07;

      // 丝带横截面呈柔和星尘带分布：中轴密集闪亮，边缘轻柔弥散
      const spread = (Math.random() + Math.random() + Math.random()) / 1.5 - 1.0;
      const halfWidth = 0.22 - 0.1 * t;
      const bandOffset = spread * halfWidth;

      // 纯平滑圆锥包络半径（略大于树枝最外端 1.045，正面全程连贯不被截断，绝无突然凸起！）
      const smoothCone = Math.pow(1.0 - t, 0.91) * TREE_BASE_RADIUS + 0.06;
      const radialScatter = (Math.random() - 0.5) * 0.09;
      const r = smoothCone * 1.06 + 0.05 + radialScatter;
      const y = TREE_BASE_Y + t * TREE_HEIGHT + bandOffset;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const [hx, hy, hz] = createHazeCloudPosition();
      hazePositions[i * 3] = hx;
      hazePositions[i * 3 + 1] = hy;
      hazePositions[i * 3 + 2] = hz;

      const centerFactor = Math.max(0, 1.0 - Math.abs(spread));
      centers[i] = centerFactor;
      sizes[i] = 0.34 + centerFactor * 0.42 + Math.random() * 0.32;
      phases[i] = Math.random() * Math.PI * 2;
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
