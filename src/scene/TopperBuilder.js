/**
 * 树顶发光粒子装饰构建器
 * --------------------------------------------------
 * 支持 3 种精致 3D 星尘粒子树顶造型一键切换：
 * 1. 细闪碎钻粒子爱心（heart）
 * 2. 经典立体五角星（star）
 * 3. 冰雪六角雪花（snowflake）
 */

import * as THREE from 'three';

const TOPPER_Y = 6.72;

const TOPPER_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aCore;
  attribute float aSparkle;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReveal;
  uniform float uBeat;

  varying float vCore;
  varying float vTwinkle;
  varying float vSparkle;
  varying float vReveal;

  void main() {
    vCore = aCore;
    vSparkle = aSparkle;

    float ease = 1.0 - pow(1.0 - clamp(uReveal, 0.0, 1.0), 3.0);
    vReveal = ease;

    float speed = aSparkle > 0.5 ? 3.8 : 2.3;
    float wave = 0.5 + 0.5 * sin(uTime * speed + aPhase);
    vTwinkle = (aSparkle > 0.5 ? mix(0.68, 1.28, pow(wave, 1.8)) : mix(0.78, 1.12, wave)) + uBeat * (aSparkle > 0.5 ? 0.26 : 0.12);

    vec3 pos = position;
    if (uReveal < 0.999) {
      float swirl = (1.0 - ease) * 2.2;
      float cs = cos(swirl);
      float sn = sin(swirl);
      vec2 radial = length(position.xy) > 0.001 ? normalize(position.xy) : vec2(0.0, 1.0);
      vec3 drifted = vec3(
        position.x + radial.x * 0.95 * (1.0 - ease),
        position.y + radial.y * 0.95 * (1.0 - ease) + sin(aPhase) * 0.22 * (1.0 - ease),
        position.z
      );
      pos = vec3(
        drifted.x * cs - drifted.z * sn,
        drifted.y,
        drifted.x * sn + drifted.z * cs
      );
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float rawSize = aSize * (0.86 + 0.24 * vTwinkle) * (1.0 + uBeat * 0.14) * mix(0.45, 1.0, ease) * uPixelRatio * (78.0 / max(-mvPosition.z, 1.0));
    gl_PointSize = clamp(rawSize, 1.4 * uPixelRatio, 8.5 * uPixelRatio);
  }
`;

const TOPPER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopperColor;

  varying float vCore;
  varying float vTwinkle;
  varying float vSparkle;
  varying float vReveal;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * 9.5);
    float halo = pow(smoothstep(0.5, 0.0, dist), 2.15);
    float crossH = exp(-abs(uv.y) * 22.0) * exp(-abs(uv.x) * 5.0);
    float crossV = exp(-abs(uv.x) * 22.0) * exp(-abs(uv.y) * 5.0);
    float starGlint = (crossH + crossV) * 0.55 * vSparkle;

    float alpha = clamp(halo * 0.66 + core * 0.42 + starGlint * 0.55, 0.0, 1.0) * vReveal;
    vec3 baseTint = mix(uTopperColor, vec3(1.0, 0.90, 0.96), vCore * 0.34 + core * 0.32);
    vec3 finalColor = mix(baseTint, vec3(1.0, 0.98, 1.0), clamp(core * 0.42 + starGlint * 0.85, 0.0, 0.85));
    gl_FragColor = vec4(finalColor * (0.64 + 0.56 * core + starGlint * 0.5) * vTwinkle, alpha * (0.52 + 0.38 * vTwinkle));
  }
`;

/**
 * 3D 立体爱心点云（轻盈碎钻轮廓 + 柔和内部星云 + 微飘外缘星尘）
 */
function buildHeartGeometry(count = 2600) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cores = new Float32Array(count);
  const sparkles = new Float32Array(count);

  const scale = 0.044;

  for (let i = 0; i < count; i += 1) {
    const u = Math.random() * Math.PI * 2;
    const rawX = 16 * Math.pow(Math.sin(u), 3);
    const rawY =
      13 * Math.cos(u) -
      5 * Math.cos(2 * u) -
      2 * Math.cos(3 * u) -
      Math.cos(4 * u);

    const pick = Math.random();
    const isHalo = pick >= 0.9;
    let fill;
    if (pick < 0.45) {
      // 45% 精致心形外轮廓线条
      fill = 0.88 + 0.14 * Math.random();
    } else if (pick < 0.9) {
      // 45% 柔和均匀内部体积填充
      fill = Math.pow(Math.random(), 0.62) * 0.92;
    } else {
      // 10% 外缘轻盈逸散微星尘
      fill = 1.02 + Math.random() * 0.14;
    }

    const x = rawX * scale * fill;
    const y = (rawY + 1.5) * scale * fill;
    const thickness = Math.sqrt(Math.max(0, 1 - Math.min(1, fill) * Math.min(1, fill) * 0.85)) * 0.22;
    const z = (Math.random() - 0.5) * 2 * thickness;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const distToCenter = Math.hypot(x, y - 0.08);
    cores[i] = Math.max(0, 1 - distToCenter / 0.62);
    const baseSize = 0.26 + Math.random() * 0.34 + (isHalo ? -0.06 : cores[i] * 0.12);
    sizes[i] = Math.max(0.18, baseSize);
    phases[i] = Math.random() * Math.PI * 2;
    sparkles[i] = Math.random() < 0.16 ? 1.0 : 0.0;
  }

  return makeGeometry(positions, sizes, phases, cores, sparkles);
}

/**
 * 3D 经典五角星点云
 */
function buildStarGeometry(count = 2200) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cores = new Float32Array(count);
  const sparkles = new Float32Array(count);

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
    sizes[i] = 0.24 + Math.random() * 0.34 + cores[i] * 0.12;
    phases[i] = Math.random() * Math.PI * 2;
    sparkles[i] = Math.random() < 0.16 ? 1.0 : 0.0;
  }

  return makeGeometry(positions, sizes, phases, cores, sparkles);
}

/**
 * 3D 冰雪六角晶花点云
 */
function buildSnowflakeGeometry(count = 2200) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cores = new Float32Array(count);
  const sparkles = new Float32Array(count);

  const armLen = 0.78;

  for (let i = 0; i < count; i += 1) {
    const armIdx = Math.floor(Math.random() * 6);
    const baseAngle = (armIdx * Math.PI) / 3 + Math.PI / 6;
    const mode = Math.random();
    let x = 0;
    let y = 0;

    if (mode < 0.52) {
      const d = Math.random() * armLen;
      const spread = (Math.random() - 0.5) * 0.07;
      x = Math.cos(baseAngle) * d - Math.sin(baseAngle) * spread;
      y = Math.sin(baseAngle) * d + Math.cos(baseAngle) * spread;
    } else if (mode < 0.86) {
      const branchBase = (0.35 + Math.floor(Math.random() * 2) * 0.3) * armLen;
      const side = Math.random() < 0.5 ? 1 : -1;
      const branchAngle = baseAngle + side * (Math.PI / 3);
      const bd = Math.random() * 0.28;
      x = Math.cos(baseAngle) * branchBase + Math.cos(branchAngle) * bd;
      y = Math.sin(baseAngle) * branchBase + Math.sin(branchAngle) * bd;
    } else {
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
    sizes[i] = 0.24 + Math.random() * 0.34 + cores[i] * 0.12;
    phases[i] = Math.random() * Math.PI * 2;
    sparkles[i] = Math.random() < 0.16 ? 1.0 : 0.0;
  }

  return makeGeometry(positions, sizes, phases, cores, sparkles);
}

function makeGeometry(positions, sizes, phases, cores, sparkles) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aCore', new THREE.BufferAttribute(cores, 1));
  geometry.setAttribute('aSparkle', new THREE.BufferAttribute(sparkles, 1));
  return geometry;
}

export class TopperBuilder {
  constructor(topperType, topperColor, sparkleTexture) {
    this.group = new THREE.Group();
    this.group.position.set(0, TOPPER_Y, 0);
    this.reveal = 1.0;

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uReveal: { value: 1.0 },
      uBeat: { value: 0 },
      uTopperColor: { value: new THREE.Color(topperColor) }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: TOPPER_VERTEX_SHADER,
      fragmentShader: TOPPER_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      fog: false
    });

    this.geometries = {
      heart: buildHeartGeometry(),
      star: buildStarGeometry(),
      snowflake: buildSnowflakeGeometry()
    };

    this.currentType = this.geometries[topperType] ? topperType : 'heart';
    this.pointsMesh = new THREE.Points(this.geometries[this.currentType], this.material);
    this.pointsMesh.renderOrder = 5;
    this.group.add(this.pointsMesh);

    // 柔和外圈彩色光晕（垫在粒子后方，烘托梦幻星云通透感）
    this.haloMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color(topperColor),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false
    });
    this.haloSprite = new THREE.Sprite(this.haloMat);
    this.haloSprite.scale.set(2.0, 2.0, 1);
    this.haloSprite.position.set(0, 0.04, -0.06);
    this.haloSprite.renderOrder = 4;
    this.group.add(this.haloSprite);

    // 克制细腻的中心暖星芒光斑（不再用硕大白十字挡住爱心质感）
    this.flareMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color('#fff5fa').lerp(new THREE.Color(topperColor), 0.2),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false
    });
    this.coreFlare = new THREE.Sprite(this.flareMat);
    this.coreFlare.scale.set(0.92, 0.92, 1);
    this.coreFlare.position.set(0, 0.04, 0.14);
    this.coreFlare.renderOrder = 6;
    this.group.add(this.coreFlare);
  }

  setType(type) {
    if (!this.geometries[type] || type === this.currentType) return;
    this.currentType = type;
    this.pointsMesh.geometry = this.geometries[type];
  }

  setColor(hex) {
    this.uniforms.uTopperColor.value.set(hex);
    this.haloMat.color.set(hex);
    this.flareMat.color.set('#fff5fa').lerp(new THREE.Color(hex), 0.2);
  }

  setPixelRatio(ratio) {
    this.uniforms.uPixelRatio.value = ratio;
  }

  /**
   * 设置开场树顶粒子由星尘旋涡细腻凝结的显现进度 [0, 1]（告别生硬实体弹跳缩放）
   */
  setReveal(progress) {
    const t = Math.min(1, Math.max(0, progress));
    const ease = 1 - Math.pow(1 - t, 3);
    this.reveal = t;
    this.uniforms.uReveal.value = t;
    this.group.visible = t > 0.001;
    this.group.scale.setScalar(1);

    this.flareMat.opacity = 0.42 * ease * ease;
    this.haloMat.opacity = 0.22 * ease;
  }

  update(elapsed, camera = null, beat = 0) {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uBeat.value = beat;

    // 树顶装饰优雅轻盈漂浮；始终正面朝向相机并带轻微摇曳，避免镜头转到侧面时爱心变成竖条椭圆
    this.group.position.y = TOPPER_Y + Math.sin(elapsed * 1.6) * 0.06;
    const camYaw = camera ? Math.atan2(camera.position.x, camera.position.z) : 0;
    this.pointsMesh.rotation.y = camYaw + Math.sin(elapsed * 1.1) * 0.16;

    // 柔和核心星芒脉动 + 随八音盒节拍轻轻律动
    const pulse = 1.0 + 0.08 * Math.sin(elapsed * 3.1);
    const beatBoost = 1.0 + beat * 0.18;
    this.coreFlare.scale.set(0.92 * pulse * beatBoost, 0.92 * pulse * beatBoost, 1);
    this.haloSprite.scale.set(2.0 * pulse * beatBoost, 2.0 * pulse * beatBoost, 1);
  }
}
