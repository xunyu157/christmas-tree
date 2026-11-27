/**
 * 3D 碎钻粒子圣诞树主体 + 螺旋星光丝带构建器
 * --------------------------------------------------
 * 采用自定义 GLSL 着色器渲染约 2.6 万颗闪烁碎钻粒子，
 * 颜色全部通过 GPU Uniform 实时切换，拖动取色器也能保持 60 帧丝滑流畅。
 */

import * as THREE from 'three';

const TREE_HEIGHT = 10.6;
const TREE_BASE_Y = -4.35;
const TREE_BASE_RADIUS = 3.85;

/**
 * 计算某个归一化高度 t ∈ [0, 1] 对应的树身基础半径
 * 带有自然的层叠枝叶波浪轮廓，而非生硬的几何圆锥
 */
function getConeRadius(t, angle) {
  const envelope = Math.pow(1 - t, 0.92) * TREE_BASE_RADIUS + 0.07;
  // 纵向层叠枝叶起伏
  const tierWave = 1.0 + 0.13 * Math.sin(t * Math.PI * 13.0) * (1.0 - t * 0.42);
  // 环向蓬松树枝分叉感
  const branchCount = 8.0 - Math.floor(t * 3.0);
  const branchWave = 1.0 + 0.1 * Math.cos(angle * branchCount + t * 16.0) * (1.0 - t * 0.3);
  return envelope * tierWave * branchWave;
}

const TREE_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aTone;
  attribute float aSparkle;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vTone;
  varying float vTwinkle;
  varying float vSparkle;

  void main() {
    vTone = aTone;
    vSparkle = aSparkle;

    // 每颗碎钻粒子按各自相位轻盈闪烁，模拟细闪星钻质感
    float speed = aSparkle > 0.5 ? 3.8 : 2.1;
    float wave = 0.5 + 0.5 * sin(uTime * speed + aPhase);
    vTwinkle = aSparkle > 0.5 ? mix(0.35, 1.35, pow(wave, 2.2)) : mix(0.62, 1.12, wave);

    // 树身极其轻微的呼吸起伏
    vec3 pos = position;
    pos.y += sin(uTime * 0.9 + aPhase) * 0.018;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float sizePulse = aSparkle > 0.5 ? (0.85 + 0.45 * wave) : 1.0;
    gl_PointSize = aSize * sizePulse * uPixelRatio * (185.0 / max(-mvPosition.z, 1.0));
  }
`;

const TREE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorDeep;

  varying float vTone;
  varying float vTwinkle;
  varying float vSparkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    // 普通粒子：柔和圆光斑；高亮碎钻：自带精致十字星芒
    float softDot = smoothstep(0.5, 0.04, dist);
    float alpha = pow(softDot, 1.85);

    if (vSparkle > 0.5) {
      float crossH = exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 4.5);
      float crossV = exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 4.5);
      float core = exp(-dist * 10.0);
      alpha = clamp(core + (crossH + crossV) * 0.72, 0.0, 1.0);
    }

    // 按颗粒层次在 深色树芯 -> 主题主色 -> 香槟珍珠高光 之间平滑过渡
    vec3 color;
    if (vTone < 0.42) {
      color = mix(uColorDeep, uColorPrimary, vTone / 0.42);
    } else if (vTone < 0.86) {
      color = mix(uColorPrimary, uColorSecondary, (vTone - 0.42) / 0.44);
    } else {
      color = mix(uColorSecondary, vec3(1.0, 0.99, 1.0), (vTone - 0.86) / 0.14);
    }

    gl_FragColor = vec4(color * vTwinkle, alpha * 0.92);
  }
`;

const RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aHeight;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vGlow;

  void main() {
    // 金色螺旋丝带上的流动光波（自下而上缓缓流淌）
    float flow = 0.5 + 0.5 * sin(aHeight * 22.0 - uTime * 2.6 + aPhase * 0.3);
    float twinkle = 0.72 + 0.38 * sin(uTime * 3.4 + aPhase);
    vGlow = mix(0.75, 1.4, flow) * twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (0.9 + 0.22 * flow) * uPixelRatio * (195.0 / max(-mvPosition.z, 1.0));
  }
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uRibbonColor;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = pow(smoothstep(0.5, 0.02, dist), 1.9);
    vec3 color = mix(uRibbonColor, vec3(1.0, 0.98, 0.9), smoothstep(0.28, 0.0, dist) * 0.65);
    gl_FragColor = vec4(color * vGlow, core * 0.95);
  }
`;

export class TreeBuilder {
  constructor(colors, isMobile = false) {
    this.group = new THREE.Group();
    this.particleCount = isMobile ? 19000 : 27000;
    this.ribbonCount = isMobile ? 3200 : 4400;

    this.treeUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uColorPrimary: { value: new THREE.Color(colors.treePrimary) },
      uColorSecondary: { value: new THREE.Color(colors.treeSecondary) },
      uColorDeep: { value: new THREE.Color(colors.treeDeep) }
    };

    this.ribbonUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uRibbonColor: { value: new THREE.Color(colors.ribbonColor) }
    };

    this.treeMesh = this._buildTreeParticles();
    this.ribbonMesh = this._buildRibbonParticles();

    this.group.add(this.treeMesh);
    this.group.add(this.ribbonMesh);
  }

  _buildTreeParticles() {
    const count = this.particleCount;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const tones = new Float32Array(count);
    const sparkles = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      // 偏向底部均匀铺满表面积，同时保证树尖致密清晰
      const u = Math.random();
      const t = 1.0 - Math.pow(u, 0.58);
      const angle = Math.random() * Math.PI * 2;
      const maxR = getConeRadius(t, angle);

      // 72% 分布在表面形成晶莹轮廓，28% 填充内部增强厚实立体感
      const isOuter = Math.random() < 0.72;
      const rFactor = isOuter
        ? 0.72 + 0.28 * Math.pow(Math.random(), 0.45)
        : 0.16 + 0.56 * Math.random();

      const r = maxR * rFactor;
      const y = TREE_BASE_Y + t * TREE_HEIGHT + (Math.random() - 0.5) * 0.16;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      // 约 6.5% 为大型十字闪钻高光颗粒
      const isSparkle = isOuter && Math.random() < 0.065;
      sparkles[i] = isSparkle ? 1.0 : 0.0;

      if (isSparkle) {
        sizes[i] = 1.45 + Math.random() * 1.45;
        tones[i] = 0.82 + Math.random() * 0.18;
      } else if (isOuter) {
        sizes[i] = 0.42 + Math.random() * 0.72;
        tones[i] = 0.36 + Math.random() * 0.58;
      } else {
        sizes[i] = 0.45 + Math.random() * 0.58;
        tones[i] = Math.random() * 0.42;
      }

      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1));
    geometry.setAttribute('aSparkle', new THREE.BufferAttribute(sparkles, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.treeUniforms,
      vertexShader: TREE_VERTEX_SHADER,
      fragmentShader: TREE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  _buildRibbonParticles() {
    const count = this.ribbonCount;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const heights = new Float32Array(count);

    const turns = 5.6;

    for (let i = 0; i < count; i += 1) {
      const t = 0.03 + Math.random() * 0.94;
      const baseAngle = t * Math.PI * 2 * turns;
      // 丝带宽度随高度自然收细
      const bandWidth = (0.16 + 0.14 * (1 - t)) * (Math.random() - 0.5);
      const radialJitter = (Math.random() - 0.5) * 0.14;
      const baseR = Math.pow(1 - t, 0.92) * TREE_BASE_RADIUS + 0.16;
      const r = baseR * 1.07 + radialJitter;

      const angle = baseAngle + (Math.random() - 0.5) * 0.11;
      const y = TREE_BASE_Y + t * TREE_HEIGHT + bandWidth;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      sizes[i] = 0.55 + Math.random() * 0.85;
      phases[i] = Math.random() * Math.PI * 2;
      heights[i] = t;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.ribbonUniforms,
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  setColors(colors) {
    this.treeUniforms.uColorPrimary.value.set(colors.treePrimary);
    this.treeUniforms.uColorSecondary.value.set(colors.treeSecondary);
    this.treeUniforms.uColorDeep.value.set(colors.treeDeep);
    this.ribbonUniforms.uRibbonColor.value.set(colors.ribbonColor);
  }

  setRibbonVisible(visible) {
    this.ribbonMesh.visible = visible;
  }

  setPixelRatio(ratio) {
    this.treeUniforms.uPixelRatio.value = ratio;
    this.ribbonUniforms.uPixelRatio.value = ratio;
  }

  update(elapsed) {
    this.treeUniforms.uTime.value = elapsed;
    this.ribbonUniforms.uTime.value = elapsed;
  }
}
