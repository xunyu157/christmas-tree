/**
 * 底部星河漩涡与柔光水雾底座
 * --------------------------------------------------
 * 精准还原示例图树底那一圈圈如水波涟漪般扩散的星光漩涡 + 柔和冰蓝月光雾晕。
 */

import * as THREE from 'three';

const VORTEX_Y = -4.42;

const VORTEX_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aGold;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vGold;
  varying float vTwinkle;
  varying float vEdgeFade;

  void main() {
    vGold = aGold;
    vTwinkle = 0.65 + 0.45 * sin(uTime * 2.5 + aPhase);
    vEdgeFade = smoothstep(10.5, 6.4, aRadius);

    vec3 pos = position;
    // 如星河水面般向外微微荡漾的涟漪起伏
    pos.y += sin(aRadius * 1.8 - uTime * 1.45 + aPhase * 0.25) * 0.075;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (185.0 / max(-mvPosition.z, 1.0));
  }
`;

const VORTEX_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uVortexColor;
  uniform vec3 uGoldColor;

  varying float vGold;
  varying float vTwinkle;
  varying float vEdgeFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float alpha = pow(smoothstep(0.5, 0.04, dist), 1.9);
    vec3 base = mix(uVortexColor, vec3(0.96, 0.98, 1.0), 0.52);
    vec3 color = mix(base, uGoldColor, vGold);
    gl_FragColor = vec4(color * vTwinkle, alpha * (0.38 + 0.55 * vEdgeFade));
  }
`;

export class GroundVortex {
  constructor(colors, mistTexture, isMobile = false) {
    this.group = new THREE.Group();
    this.group.position.set(0, VORTEX_Y, 0);

    this.particleCount = isMobile ? 7600 : 11200;

    // 1. 底部柔和径向雾光圆盘（烘托梦幻漂浮感）
    const mistGeo = new THREE.PlaneGeometry(15.2, 15.2);
    this.mistMat = new THREE.MeshBasicMaterial({
      map: mistTexture,
      color: new THREE.Color(colors.vortexColor),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.mistMesh = new THREE.Mesh(mistGeo, this.mistMat);
    this.mistMesh.rotation.x = -Math.PI / 2;
    this.mistMesh.position.y = -0.06;
    this.group.add(this.mistMesh);

    // 2. 多层同心螺旋星尘粒子环
    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uVortexColor: { value: new THREE.Color(colors.vortexColor) },
      uGoldColor: { value: new THREE.Color(colors.ribbonColor) }
    };

    this.pointsMesh = this._buildVortexParticles();
    this.group.add(this.pointsMesh);
  }

  _buildVortexParticles() {
    const count = this.particleCount;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const radii = new Float32Array(count);
    const golds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const band = Math.random();
      let r = 0;
      let angle = 0;
      let y = 0;
      let goldMix = 0;
      let size = 0.5;

      if (band < 0.56) {
        // 紧致的同心螺旋星轨（复刻示例图中心的金色/银白漩涡纹理）
        const arm = Math.floor(Math.random() * 5);
        const t = Math.pow(Math.random(), 0.72);
        r = 0.65 + t * 6.45;
        angle = t * Math.PI * 7.8 + (arm * Math.PI * 2) / 5 + (Math.random() - 0.5) * 0.45;
        y = (Math.random() - 0.5) * 0.14;
        goldMix = Math.random() < 0.42 ? 0.72 : 0.12;
        size = 0.45 + Math.random() * 0.7;
      } else if (band < 0.78) {
        // 柔和的同心涟漪细密光带
        const ringIndex = Math.floor(Math.random() * 6);
        r = 1.4 + ringIndex * 1.02 + (Math.random() - 0.5) * 0.42;
        angle = Math.random() * Math.PI * 2;
        y = (Math.random() - 0.5) * 0.16;
        goldMix = ringIndex % 2 === 0 ? 0.55 : 0.08;
        size = 0.4 + Math.random() * 0.62;
      } else {
        // 外圈清澈星屑环（对应示例图雾晕外侧散落的白色碎星）
        r = 6.9 + Math.random() * 3.1;
        angle = Math.random() * Math.PI * 2;
        y = (Math.random() - 0.5) * 0.25;
        goldMix = 0.05;
        size = 0.52 + Math.random() * 0.78;
      }

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      sizes[i] = size;
      phases[i] = Math.random() * Math.PI * 2;
      radii[i] = r;
      golds[i] = goldMix;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute('aGold', new THREE.BufferAttribute(golds, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VORTEX_VERTEX_SHADER,
      fragmentShader: VORTEX_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  setColors(colors) {
    this.mistMat.color.set(colors.vortexColor);
    this.uniforms.uVortexColor.value.set(colors.vortexColor);
    this.uniforms.uGoldColor.value.set(colors.ribbonColor);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  setPixelRatio(ratio) {
    this.uniforms.uPixelRatio.value = ratio;
  }

  update(elapsed, delta) {
    this.uniforms.uTime.value = elapsed;
    this.pointsMesh.rotation.y += delta * 0.13;
  }
}
