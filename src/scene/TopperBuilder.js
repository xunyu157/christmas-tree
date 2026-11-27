/**
 * 树顶发光粒子装饰构建器
 * --------------------------------------------------
 * 支持 3 种精致 3D 粒子树顶造型一键切换：
 * 1. 发光粒子爱心（heart，还原示例图同款粉色星芒爱心）
 * 2. 经典立体五角星（star）
 * 3. 冰雪六角雪花（snowflake）
 */

import * as THREE from 'three';

const TOPPER_Y = 6.92;

const TOPPER_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aCore;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vCore;
  varying float vTwinkle;

  void main() {
    vCore = aCore;
    vTwinkle = 0.78 + 0.34 * sin(uTime * 3.2 + aPhase);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (190.0 / max(-mvPosition.z, 1.0));
  }
`;

const TOPPER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopperColor;

  varying float vCore;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float alpha = pow(smoothstep(0.5, 0.02, dist), 1.8);
    // 越靠近中心越偏暖白高光，外沿呈现璀璨主色
    vec3 color = mix(uTopperColor, vec3(1.0, 0.96, 0.99), clamp(vCore * 0.85, 0.0, 1.0));
    gl_FragColor = vec4(color * vTwinkle * 1.25, alpha);
  }
`;

/**
 * 3D 立体爱心点云（经典心形参数方程 + 饱满厚度）
 */
function buildHeartGeometry(count = 2400) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cores = new Float32Array(count);

  const scale = 0.044;

  for (let i = 0; i < count; i += 1) {
    const u = Math.random() * Math.PI * 2;
    const rawX = 16 * Math.pow(Math.sin(u), 3);
    const rawY =
      13 * Math.cos(u) -
      5 * Math.cos(2 * u) -
      2 * Math.cos(3 * u) -
      Math.cos(4 * u);

    // 45% 勾勒轮廓，55% 饱满填充内部
    const fill = Math.random() < 0.45 ? 0.88 + 0.14 * Math.random() : Math.pow(Math.random(), 0.55);
    const x = rawX * scale * fill;
    const y = (rawY + 1.5) * scale * fill;

    // 越靠近中心越饱满厚实，边缘自然收薄
    const thickness = Math.sqrt(Math.max(0, 1 - fill * fill * 0.82)) * 0.34;
    const z = (Math.random() - 0.5) * 2 * thickness;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const distToCenter = Math.hypot(x, y - 0.08);
    cores[i] = Math.max(0, 1 - distToCenter / 0.62);
    sizes[i] = 0.52 + Math.random() * 0.72 + cores[i] * 0.55;
    phases[i] = Math.random() * Math.PI * 2;
  }

  return makeGeometry(positions, sizes, phases, cores);
}

/**
 * 3D 经典五角星点云
 */
function buildStarGeometry(count = 2200) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cores = new Float32Array(count);

  const outerR = 0.78;
  const innerR = 0.34;
  const vertices = [];
  for (let k = 0; k < 10; k += 1) {
    const a = (k * Math.PI) / 5 + Math.PI / 2;
    const r = k % 2 === 0 ? outerR : innerR;
    vertices.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  for (let i = 0; i < count; i += 1) {
    const seg = Math.floor(Math.random() * 10);
    const v1 = vertices[seg];
    const v2 = vertices[(seg + 1) % 10];

    // 在由中心和每条边组成的三角形内均匀采样（轮廓更密）
    const edgeT = Math.random();
    const isOutline = Math.random() < 0.42;
    const radial = isOutline ? 0.92 + Math.random() * 0.09 : Math.pow(Math.random(), 0.52);

    const ex = v1[0] + (v2[0] - v1[0]) * edgeT;
    const ey = v1[1] + (v2[1] - v1[1]) * edgeT;

    const x = ex * radial;
    const y = ey * radial;
    const z = (Math.random() - 0.5) * 0.34 * (1 - radial * 0.78);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    cores[i] = Math.max(0, 1 - radial);
    sizes[i] = 0.5 + Math.random() * 0.75 + cores[i] * 0.5;
    phases[i] = Math.random() * Math.PI * 2;
  }

  return makeGeometry(positions, sizes, phases, cores);
}

/**
 * 3D 冰雪六角晶花点云
 */
function buildSnowflakeGeometry(count = 2200) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cores = new Float32Array(count);

  const armLen = 0.78;

  for (let i = 0; i < count; i += 1) {
    const armIdx = Math.floor(Math.random() * 6);
    const baseAngle = (armIdx * Math.PI) / 3 + Math.PI / 6;
    const mode = Math.random();
    let x = 0;
    let y = 0;

    if (mode < 0.52) {
      // 主冰晶轴
      const d = Math.random() * armLen;
      const spread = (Math.random() - 0.5) * 0.07;
      x = Math.cos(baseAngle) * d - Math.sin(baseAngle) * spread;
      y = Math.sin(baseAngle) * d + Math.cos(baseAngle) * spread;
    } else if (mode < 0.86) {
      // 两侧对称分支羽毛
      const branchBase = (0.35 + Math.floor(Math.random() * 2) * 0.3) * armLen;
      const side = Math.random() < 0.5 ? 1 : -1;
      const branchAngle = baseAngle + side * (Math.PI / 3);
      const bd = Math.random() * 0.28;
      x = Math.cos(baseAngle) * branchBase + Math.cos(branchAngle) * bd;
      y = Math.sin(baseAngle) * branchBase + Math.sin(branchAngle) * bd;
    } else {
      // 中心六边晶环
      const nextAngle = baseAngle + Math.PI / 3;
      const s = Math.random();
      const ringR = 0.28;
      x = (Math.cos(baseAngle) * (1 - s) + Math.cos(nextAngle) * s) * ringR;
      y = (Math.sin(baseAngle) * (1 - s) + Math.sin(nextAngle) * s) * ringR;
    }

    const z = (Math.random() - 0.5) * 0.14;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const rNorm = Math.min(1, Math.hypot(x, y) / armLen);
    cores[i] = 1 - rNorm;
    sizes[i] = 0.48 + Math.random() * 0.68 + cores[i] * 0.5;
    phases[i] = Math.random() * Math.PI * 2;
  }

  return makeGeometry(positions, sizes, phases, cores);
}

function makeGeometry(positions, sizes, phases, cores) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aCore', new THREE.BufferAttribute(cores, 1));
  return geometry;
}

export class TopperBuilder {
  constructor(topperType, topperColor, sparkleTexture) {
    this.group = new THREE.Group();
    this.group.position.set(0, TOPPER_Y, 0);

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uTopperColor: { value: new THREE.Color(topperColor) }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: TOPPER_VERTEX_SHADER,
      fragmentShader: TOPPER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.geometries = {
      heart: buildHeartGeometry(),
      star: buildStarGeometry(),
      snowflake: buildSnowflakeGeometry()
    };

    this.currentType = this.geometries[topperType] ? topperType : 'heart';
    this.pointsMesh = new THREE.Points(this.geometries[this.currentType], this.material);
    this.group.add(this.pointsMesh);

    // 中心炽白星芒光斑（高度还原示例图中爱心正中央的强光星芒！）
    this.flareMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreFlare = new THREE.Sprite(this.flareMat);
    this.coreFlare.scale.set(2.15, 2.15, 1);
    this.coreFlare.position.set(0, 0.06, 0.02);
    this.group.add(this.coreFlare);

    // 柔和外圈彩色光晕
    this.haloMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color(topperColor),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.haloSprite = new THREE.Sprite(this.haloMat);
    this.haloSprite.scale.set(3.2, 3.2, 1);
    this.haloSprite.position.set(0, 0.06, 0);
    this.group.add(this.haloSprite);
  }

  setType(type) {
    if (!this.geometries[type] || type === this.currentType) return;
    this.currentType = type;
    this.pointsMesh.geometry = this.geometries[type];
  }

  setColor(hex) {
    this.uniforms.uTopperColor.value.set(hex);
    this.haloMat.color.set(hex);
  }

  setPixelRatio(ratio) {
    this.uniforms.uPixelRatio.value = ratio;
  }

  update(elapsed) {
    this.uniforms.uTime.value = elapsed;

    // 树顶装饰优雅轻盈漂浮 + 缓慢摇曳
    this.group.position.y = TOPPER_Y + Math.sin(elapsed * 1.6) * 0.06;
    this.pointsMesh.rotation.y = Math.sin(elapsed * 0.7) * 0.28;

    // 核心星芒呼吸脉动
    const pulse = 1.0 + 0.1 * Math.sin(elapsed * 3.1);
    this.coreFlare.scale.set(2.15 * pulse, 2.15 * pulse, 1);
    this.haloSprite.scale.set(3.2 * pulse, 3.2 * pulse, 1);
  }
}
