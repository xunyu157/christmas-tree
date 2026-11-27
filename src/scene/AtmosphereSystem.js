/**
 * 夜空星辰 + 四芒星芒 + 轻盈飘雪氛围系统
 */

import * as THREE from 'three';

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vAlpha;

  void main() {
    float twinkle = 0.5 + 0.5 * sin(uTime * 1.9 + aPhase);
    vAlpha = mix(0.22, 0.96, pow(twinkle, 1.8));

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (220.0 / max(-mvPosition.z, 1.0));
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    if (tex.a < 0.02) discard;
    gl_FragColor = vec4(vec3(0.95, 0.96, 1.0), tex.a * vAlpha);
  }
`;

export class AtmosphereSystem {
  constructor(dotTexture, sparkleTexture, isMobile = false) {
    this.group = new THREE.Group();

    this.starUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uMap: { value: sparkleTexture }
    };

    this.starsGroup = new THREE.Group();
    this.starsGroup.add(this._buildStarfield(isMobile ? 750 : 1200, dotTexture, 1.15));
    this.starsGroup.add(this._buildCrossStars(isMobile ? 75 : 125));
    this.group.add(this.starsGroup);

    this.snowCount = isMobile ? 650 : 1050;
    this.snowData = [];
    this.snowMesh = this._buildSnow(dotTexture);
    this.group.add(this.snowMesh);
  }

  _buildStarfield(count, dotTexture, sizeScale) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const r = 24 + Math.random() * 28;
      const theta = Math.random() * Math.PI * 2;
      const y = -6 + Math.random() * 26;

      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;

      sizes[i] = (0.45 + Math.random() * 0.9) * sizeScale;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.starUniforms.uTime,
        uPixelRatio: this.starUniforms.uPixelRatio,
        uMap: { value: dotTexture }
      },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  _buildCrossStars(count) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      // 集中在夜空上半部与树后背景，复刻示例图零星闪耀的四角星芒
      const x = (Math.random() - 0.5) * 32;
      const y = -1.5 + Math.random() * 19;
      const z = -9 - Math.random() * 18;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      sizes[i] = 1.6 + Math.random() * 1.9;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  _buildSnow(dotTexture) {
    const positions = new Float32Array(this.snowCount * 3);

    for (let i = 0; i < this.snowCount; i += 1) {
      const x = (Math.random() - 0.5) * 26;
      const y = -5 + Math.random() * 19;
      const z = (Math.random() - 0.5) * 24;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.snowData.push({
        fallSpeed: 0.45 + Math.random() * 0.75,
        swaySpeed: 0.5 + Math.random() * 0.9,
        swayAmp: 0.12 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.14,
      map: dotTexture,
      color: new THREE.Color('#eef6ff'),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  setStarsVisible(visible) {
    this.starsGroup.visible = visible;
  }

  setSnowVisible(visible) {
    this.snowMesh.visible = visible;
  }

  setPixelRatio(ratio) {
    this.starUniforms.uPixelRatio.value = ratio;
  }

  update(elapsed, delta) {
    this.starUniforms.uTime.value = elapsed;

    if (!this.snowMesh.visible) return;
    const pos = this.snowMesh.geometry.attributes.position.array;

    for (let i = 0; i < this.snowCount; i += 1) {
      const d = this.snowData[i];
      pos[i * 3 + 1] -= d.fallSpeed * delta;
      pos[i * 3] += Math.sin(elapsed * d.swaySpeed + d.phase) * d.swayAmp * delta;

      if (pos[i * 3 + 1] < -5.2) {
        pos[i * 3 + 1] = 13.8;
        pos[i * 3] = (Math.random() - 0.5) * 26;
      }
    }
    this.snowMesh.geometry.attributes.position.needsUpdate = true;
  }
}
