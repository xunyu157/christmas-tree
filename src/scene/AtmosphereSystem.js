/**
 * 夜空星辰 + 四芒星芒 + 轻盈飘雪氛围系统
 */

import * as THREE from 'three';

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float twinkle = 0.5 + 0.5 * sin(uTime * 1.9 + aPhase);
    vAlpha = mix(0.24, 0.96, pow(twinkle, 1.8));
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (uSizeScale / max(-mvPosition.z, 1.0));
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    if (tex.a < 0.02) discard;
    gl_FragColor = vec4(vColor, tex.a * vAlpha);
  }
`;

function pickStarColor(out, idxOffset = 0) {
  const p = (Math.random() + idxOffset) % 1;
  if (p < 0.52) {
    out.setRGB(0.94, 0.96, 1.0);
  } else if (p < 0.74) {
    out.setRGB(0.74, 0.86, 1.0);
  } else if (p < 0.92) {
    out.setRGB(1.0, 0.92, 0.78);
  } else {
    out.setRGB(1.0, 0.82, 0.68);
  }
}

export class AtmosphereSystem {
  constructor(dotTexture, sparkleTexture, isMobile = false) {
    this.group = new THREE.Group();

    this.starUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uMap: { value: sparkleTexture },
      uSizeScale: { value: 340.0 }
    };

    this.starsGroup = new THREE.Group();
    this.starsGroup.add(this._buildStarfield(isMobile ? 950 : 1600, dotTexture, 1.15));
    this.starsGroup.add(this._buildMilkyWayBand(isMobile ? 480 : 850, dotTexture));
    this.starsGroup.add(this._buildCrossStars(isMobile ? 55 : 90));
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
    const colors = new Float32Array(count * 3);
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      // 远景 360° 天穹群星（位于远山 r=41~65 与黑云 r=73~85 之后，遮挡层次真实自然）
      const r = 96 + Math.random() * 26;
      const theta = Math.random() * Math.PI * 2;
      const sinPhi = Math.random() < 0.86
        ? Math.pow(Math.random(), 0.78)
        : -(Math.random() * 0.18);
      const y = sinPhi * r - 1.5;
      const horizR = Math.sqrt(Math.max(0.01, r * r - y * y));

      positions[i * 3] = Math.cos(theta) * horizR;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * horizR;

      sizes[i] = (0.45 + Math.pow(Math.random(), 2.3) * 1.45) * sizeScale;
      phases[i] = Math.random() * Math.PI * 2;

      pickStarColor(tmp);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.starUniforms.uTime,
        uPixelRatio: this.starUniforms.uPixelRatio,
        uMap: { value: dotTexture },
        uSizeScale: this.starUniforms.uSizeScale
      },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  _buildMilkyWayBand(count, dotTexture) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const tilt = new THREE.Euler(0.66, 0.35, -0.42);
    const dir = new THREE.Vector3();
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      // 近似高斯条带分布，形成横跨天际的淡雅银河微尘带
      const spread = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 0.36;
      const r = 104 + Math.random() * 12;

      dir.set(
        Math.cos(theta) * Math.cos(spread),
        Math.sin(spread),
        Math.sin(theta) * Math.cos(spread)
      );
      dir.applyEuler(tilt).multiplyScalar(r);

      positions[i * 3] = dir.x;
      positions[i * 3 + 1] = Math.abs(dir.y) * 0.85 + 2.5;
      positions[i * 3 + 2] = dir.z;

      sizes[i] = 0.35 + Math.random() * 0.55;
      phases[i] = Math.random() * Math.PI * 2;

      const fade = 0.38 + Math.random() * 0.3;
      if (Math.random() < 0.65) {
        tmp.setRGB(0.76 * fade, 0.84 * fade, 1.0 * fade);
      } else {
        tmp.setRGB(0.88 * fade, 0.86 * fade, 1.0 * fade);
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.starUniforms.uTime,
        uPixelRatio: this.starUniforms.uPixelRatio,
        uMap: { value: dotTexture },
        uSizeScale: this.starUniforms.uSizeScale
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
    const colors = new Float32Array(count * 3);
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      // 全周 360° 远景亮星（位于黑云与山脊后方，360° 旋转均有清澈闪烁四角星芒）
      const r = 92 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = 0.16 + Math.random() * 1.09;
      const horizR = Math.cos(phi) * r;

      positions[i * 3] = Math.cos(theta) * horizR;
      positions[i * 3 + 1] = Math.sin(phi) * r;
      positions[i * 3 + 2] = Math.sin(theta) * horizR;

      sizes[i] = 1.65 + Math.random() * 1.9;
      phases[i] = Math.random() * Math.PI * 2;

      pickStarColor(tmp);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

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
