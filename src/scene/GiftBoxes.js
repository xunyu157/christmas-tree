/**
 * 圣诞树底部 3D 节日礼物盒群（GiftBoxes）
 * --------------------------------------------------
 * 在中央碎钻粒子圣诞树底座周围布置 21 个 360° 错落有致的立体圣诞礼物盒：
 * 1. 5 款程序化精致包装纸纹理（丝绒红斜纹、森绿碎雪星点、星夜蓝波点、香槟金菱格、主题联动缎面）；
 * 2. 外延盒盖、贴合十字丝带、立体 4 瓣蝴蝶结与冬青红果点缀，按材质合批渲染以保证移动端流畅；
 * 3. 挂载 GPU 世界高度光幕着色器（#include <dithering_fragment> 前截断），随开场光瀑倾泻同步点亮；
 * 4. 严格避让中央树芯遮挡锥与右侧 3D 小雪人（4.45, -0.80），并控制高光低于 Bloom 阈值防过曝。
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const GIFT_GROUND_Y = -4.56;

const GIFT_SPECS = [
  // 前左主礼堆
  { shape: 'box', x: -1.65, z: 3.95, w: 1.18, h: 0.86, d: 1.06, rotY: 0.28, wrap: 'wrapCrimson', ribbon: 'ribbonGold', hasTopStack: true },
  { shape: 'box', x: -1.65, z: 3.95, baseYOffset: 0.86, w: 0.64, h: 0.46, d: 0.62, rotY: -0.35, wrap: 'wrapChampagne', ribbon: 'ribbonCrimson', holly: true },
  { shape: 'box', x: -2.98, z: 3.12, w: 0.78, h: 0.96, d: 0.76, rotY: -0.22, wrap: 'wrapEmerald', ribbon: 'ribbonGold' },
  { shape: 'round', x: -3.08, z: 4.40, radius: 0.46, h: 0.56, rotY: 0.40, wrap: 'wrapNavy', ribbon: 'ribbonSilver' },
  { shape: 'box', x: -0.66, z: 4.86, w: 0.54, h: 0.42, d: 0.54, rotY: 0.52, wrap: 'wrapTheme', ribbon: 'ribbonGold' },

  // 前右礼堆（中缝留白让星河漩涡与树裙呼应）
  { shape: 'box', x: 1.58, z: 4.02, w: 1.12, h: 0.66, d: 0.94, rotY: -0.32, wrap: 'wrapNavy', ribbon: 'ribbonGold', hasTopStack: true },
  { shape: 'box', x: 1.58, z: 4.02, baseYOffset: 0.66, w: 0.58, h: 0.44, d: 0.56, rotY: 0.22, wrap: 'wrapCrimson', ribbon: 'ribbonGold', holly: true },
  { shape: 'box', x: 2.90, z: 3.06, w: 0.86, h: 0.78, d: 0.84, rotY: 0.36, wrap: 'wrapChampagne', ribbon: 'ribbonCrimson', holly: true },
  { shape: 'box', x: 2.86, z: 4.38, w: 0.52, h: 0.46, d: 0.52, rotY: -0.48, wrap: 'wrapEmerald', ribbon: 'ribbonGold' },
  { shape: 'round', x: 0.44, z: 4.78, radius: 0.36, h: 0.42, rotY: 0.15, wrap: 'wrapTheme', ribbon: 'ribbonSilver' },

  // 小雪人身旁伴手礼
  { shape: 'box', x: 4.08, z: 0.72, w: 0.60, h: 0.48, d: 0.58, rotY: 0.45, wrap: 'wrapCrimson', ribbon: 'ribbonGold' },

  // 左侧礼堆
  { shape: 'box', x: -4.22, z: 0.38, w: 1.06, h: 0.82, d: 0.96, rotY: 0.42, wrap: 'wrapTheme', ribbon: 'ribbonGold', hasTopStack: true },
  { shape: 'box', x: -4.22, z: 0.38, baseYOffset: 0.82, w: 0.56, h: 0.44, d: 0.56, rotY: -0.18, wrap: 'wrapChampagne', ribbon: 'ribbonCrimson' },
  { shape: 'box', x: -4.42, z: -1.04, w: 0.84, h: 0.56, d: 0.72, rotY: -0.25, wrap: 'wrapCrimson', ribbon: 'ribbonSilver' },
  { shape: 'box', x: -5.06, z: 1.36, w: 0.54, h: 0.46, d: 0.52, rotY: 0.65, wrap: 'wrapNavy', ribbon: 'ribbonGold' },

  // 后左礼堆
  { shape: 'box', x: -2.35, z: -3.58, w: 1.08, h: 0.84, d: 0.98, rotY: -0.45, wrap: 'wrapEmerald', ribbon: 'ribbonGold', hasTopStack: true },
  { shape: 'box', x: -2.35, z: -3.58, baseYOffset: 0.84, w: 0.58, h: 0.45, d: 0.56, rotY: 0.30, wrap: 'wrapChampagne', ribbon: 'ribbonCrimson' },
  { shape: 'round', x: -1.05, z: -4.25, radius: 0.44, h: 0.54, rotY: 0.20, wrap: 'wrapCrimson', ribbon: 'ribbonGold' },

  // 后右礼堆
  { shape: 'box', x: 1.95, z: -3.82, w: 1.10, h: 0.82, d: 0.96, rotY: 0.38, wrap: 'wrapCrimson', ribbon: 'ribbonGold' },
  { shape: 'box', x: 3.08, z: -2.92, w: 0.76, h: 0.92, d: 0.74, rotY: -0.30, wrap: 'wrapTheme', ribbon: 'ribbonSilver' },
  { shape: 'box', x: 3.16, z: -4.28, w: 0.56, h: 0.44, d: 0.56, rotY: 0.55, wrap: 'wrapChampagne', ribbon: 'ribbonCrimson' }
];

const SPARKLE_VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBeat;

  varying float vTwinkle;

  void main() {
    float wave = 0.5 + 0.5 * sin(uTime * 2.8 + aPhase);
    vTwinkle = mix(0.35, 1.0, pow(wave, 2.0)) + uBeat * 0.28;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float rawSize = aSize * (0.82 + 0.28 * wave) * (1.0 + uBeat * 0.18) * uPixelRatio * (110.0 / max(-mvPosition.z, 1.0));
    gl_PointSize = min(rawSize, 16.0 * uPixelRatio);
  }
`;

const SPARKLE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uReveal;

  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float crossH = exp(-abs(uv.y) * 28.0) * exp(-abs(uv.x) * 5.2);
    float crossV = exp(-abs(uv.x) * 28.0) * exp(-abs(uv.y) * 5.2);
    float core = exp(-dist * 12.0);
    float shape = clamp(core * 0.85 + (crossH + crossV) * 0.75, 0.0, 1.0);
    float alpha = shape * 0.38 * uReveal;

    gl_FragColor = vec4(uColor * vTwinkle, alpha);
  }
`;

function createSeededRandom(seed = 20261224) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeWrapCanvas(drawFn) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawSixPointSnowflake(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 6; i += 1) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.moveTo(0, -r * 0.58);
    ctx.lineTo(-r * 0.24, -r * 0.78);
    ctx.moveTo(0, -r * 0.58);
    ctx.lineTo(r * 0.24, -r * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

function createStripeWrapTexture() {
  return makeWrapCanvas((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0.0, '#a92338');
    grad.addColorStop(0.5, '#991e31');
    grad.addColorStop(1.0, '#8a192b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    for (let offset = -size; offset < size * 2; offset += 32) {
      ctx.strokeStyle = 'rgba(245, 214, 146, 0.36)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + size, size);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 208, 222, 0.22)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(offset + 12, 0);
      ctx.lineTo(offset + 12 + size, size);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function createSnowflakeWrapTexture() {
  return makeWrapCanvas((ctx, size) => {
    const rng = createSeededRandom(3105);
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0.0, '#1b5c42');
    grad.addColorStop(1.0, '#134632');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(232, 244, 255, 0.44)';
    ctx.lineWidth = 1.5;
    const grid = [
      [42, 46, 14],
      [148, 38, 11],
      [216, 98, 13],
      [88, 132, 15],
      [182, 184, 12],
      [44, 214, 11]
    ];
    grid.forEach(([x, y, r]) => {
      [-size, 0, size].forEach((ox) => {
        [-size, 0, size].forEach((oy) => {
          drawSixPointSnowflake(ctx, x + ox, y + oy, r);
        });
      });
    });

    ctx.fillStyle = 'rgba(248, 224, 152, 0.35)';
    for (let i = 0; i < 28; i += 1) {
      const x = rng() * size;
      const y = rng() * size;
      const rad = 1.3 + rng() * 1.8;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createPolkaWrapTexture() {
  return makeWrapCanvas((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0.0, '#1f376b');
    grad.addColorStop(1.0, '#162850');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const step = 42.666;
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const x = (col + (row % 2) * 0.5) * step;
        const y = (row + 0.5) * step;
        ctx.fillStyle = 'rgba(246, 222, 158, 0.46)';
        ctx.beginPath();
        ctx.arc(x % size, y % size, (row + col) % 2 === 0 ? 4.2 : 2.8, 0, Math.PI * 2);
        ctx.fill();

        if ((row + col) % 3 === 0) {
          ctx.strokeStyle = 'rgba(235, 244, 255, 0.38)';
          ctx.lineWidth = 1.2;
          const sx = (x + step * 0.5) % size;
          const sy = (y + step * 0.25) % size;
          ctx.beginPath();
          ctx.moveTo(sx - 5, sy);
          ctx.lineTo(sx + 5, sy);
          ctx.moveTo(sx, sy - 5);
          ctx.lineTo(sx, sy + 5);
          ctx.stroke();
        }
      }
    }
  });
}

function createChampagneWrapTexture() {
  return makeWrapCanvas((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0.0, '#d8cab6');
    grad.addColorStop(1.0, '#c5b39b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(186, 148, 84, 0.24)';
    ctx.lineWidth = 1.8;
    const step = 32;
    for (let offset = -size; offset < size * 2; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + size, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offset, size);
      ctx.lineTo(offset + size, 0);
      ctx.stroke();
    }
  });
}

function createThemeSatinTexture() {
  return makeWrapCanvas((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0.0, '#f7f2f0');
    grad.addColorStop(0.5, '#ede4e2');
    grad.addColorStop(1.0, '#e3d9d8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    for (let offset = -size; offset < size * 2; offset += 20) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + size, size);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 250, 240, 0.24)';
    for (let y = 16; y < size; y += 32) {
      for (let x = 16; x < size; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function createContactShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 4, half, half, half);
  grad.addColorStop(0.0, 'rgba(6, 11, 26, 0.44)');
  grad.addColorStop(0.58, 'rgba(6, 11, 26, 0.20)');
  grad.addColorStop(1.0, 'rgba(6, 11, 26, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class GiftBoxes {
  constructor(colors) {
    this.group = new THREE.Group();
    this.cascadeUniforms = {
      uCascadeActive: { value: 0 },
      uCascadeY: { value: -30 },
      uCascadeSoft: { value: 3.8 },
      uCascadeEdge: { value: 0 }
    };
    this.sparklePoints = [];
    this._baseGold = new THREE.Color('#e2ba64');
    this._baseSilver = new THREE.Color('#cedcf0');
    this._baseSparkle = new THREE.Color('#ffe9b8');
    this._tmpHsl = { h: 0, s: 0, l: 0 };

    this._initMaterials();
    this._buildAllGifts();
    this._buildSparkles();
    this.setColors(colors);
  }

  _attachCascadeShader(material) {
    material.customProgramCacheKey = () => 'gift-topdown-cascade';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uCascadeActive = this.cascadeUniforms.uCascadeActive;
      shader.uniforms.uCascadeY = this.cascadeUniforms.uCascadeY;
      shader.uniforms.uCascadeSoft = this.cascadeUniforms.uCascadeSoft;
      shader.uniforms.uCascadeEdge = this.cascadeUniforms.uCascadeEdge;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vCascadeY;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
vec4 cascadeWorldPos = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  cascadeWorldPos = instanceMatrix * cascadeWorldPos;
#endif
cascadeWorldPos = modelMatrix * cascadeWorldPos;
vCascadeY = cascadeWorldPos.y;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uCascadeActive;
uniform float uCascadeY;
uniform float uCascadeSoft;
uniform float uCascadeEdge;
varying float vCascadeY;`
        )
        .replace(
          '#include <dithering_fragment>',
          `if ( uCascadeActive > 0.5 ) {
  float cascadeMask = smoothstep( uCascadeY - uCascadeSoft, uCascadeY + uCascadeSoft, vCascadeY );
  float edgeBand = exp( -pow( ( vCascadeY - uCascadeY ) / max( uCascadeSoft * 0.55, 0.25 ), 2.0 ) ) * uCascadeEdge;
  gl_FragColor.rgb = gl_FragColor.rgb * cascadeMask + vec3( 0.62, 0.76, 1.0 ) * edgeBand * 0.18;
}
#include <dithering_fragment>`
        );
    };
    return material;
  }

  _initMaterials() {
    const stripeTex = createStripeWrapTexture();
    const snowTex = createSnowflakeWrapTexture();
    const polkaTex = createPolkaWrapTexture();
    const champagneTex = createChampagneWrapTexture();
    const themeSatinTex = createThemeSatinTexture();
    const shadowTex = createContactShadowTexture();

    this.materials = {
      wrapCrimson: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          map: stripeTex,
          color: new THREE.Color('#ffffff'),
          emissive: new THREE.Color('#330a12'),
          emissiveIntensity: 0.26,
          roughness: 0.46,
          metalness: 0.08
        })
      ),
      wrapEmerald: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          map: snowTex,
          color: new THREE.Color('#ffffff'),
          emissive: new THREE.Color('#082418'),
          emissiveIntensity: 0.26,
          roughness: 0.48,
          metalness: 0.06
        })
      ),
      wrapNavy: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          map: polkaTex,
          color: new THREE.Color('#ffffff'),
          emissive: new THREE.Color('#0b1733'),
          emissiveIntensity: 0.28,
          roughness: 0.46,
          metalness: 0.08
        })
      ),
      wrapChampagne: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          map: champagneTex,
          color: new THREE.Color('#ffffff'),
          emissive: new THREE.Color('#2c2214'),
          emissiveIntensity: 0.20,
          roughness: 0.50,
          metalness: 0.10
        })
      ),
      wrapTheme: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          map: themeSatinTex,
          color: new THREE.Color('#9c426e'),
          emissive: new THREE.Color('#280e1d'),
          emissiveIntensity: 0.24,
          roughness: 0.44,
          metalness: 0.12
        })
      ),
      ribbonGold: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#e2ba64'),
          emissive: new THREE.Color('#473008'),
          emissiveIntensity: 0.24,
          roughness: 0.28,
          metalness: 0.52
        })
      ),
      ribbonCrimson: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#c93046'),
          emissive: new THREE.Color('#3d0912'),
          emissiveIntensity: 0.26,
          roughness: 0.34,
          metalness: 0.26
        })
      ),
      ribbonSilver: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#cedcf0'),
          emissive: new THREE.Color('#1e2c44'),
          emissiveIntensity: 0.22,
          roughness: 0.30,
          metalness: 0.46
        })
      ),
      hollyLeaf: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1e6e44'),
          emissive: new THREE.Color('#062012'),
          emissiveIntensity: 0.22,
          roughness: 0.52,
          metalness: 0.05
        })
      ),
      hollyBerry: this._attachCascadeShader(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#d42a3c'),
          emissive: new THREE.Color('#4a0810'),
          emissiveIntensity: 0.32,
          roughness: 0.26,
          metalness: 0.15
        })
      )
    };

    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.materials.shadow = this.shadowMat;
  }

  _buildAllGifts() {
    const buckets = {};
    Object.keys(this.materials).forEach((k) => {
      buckets[k] = [];
    });

    const dummy = new THREE.Object3D();
    const parentMatrix = new THREE.Matrix4();
    const localMatrix = new THREE.Matrix4();
    const finalMatrix = new THREE.Matrix4();
    const tmpVec = new THREE.Vector3();

    const pushGeo = (bucketKey, geo, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      Object.keys(g.attributes).forEach((attr) => {
        if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
          g.deleteAttribute(attr);
        }
      });
      dummy.position.set(px, py, pz);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      localMatrix.copy(dummy.matrix);
      finalMatrix.multiplyMatrices(parentMatrix, localMatrix);
      g.applyMatrix4(finalMatrix);
      buckets[bucketKey].push(g);
      geo.dispose();
    };

    GIFT_SPECS.forEach((spec, idx) => {
      const baseOffset = spec.baseYOffset || 0;
      const baseY = GIFT_GROUND_Y - (baseOffset === 0 ? 0.005 : 0.002) + baseOffset;
      const lidH = Math.min(0.14, Math.max(0.08, spec.h * 0.20));
      const bodyH = spec.h - lidH * 0.65;

      dummy.position.set(spec.x, baseY, spec.z);
      dummy.rotation.set(0, spec.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      parentMatrix.copy(dummy.matrix);

      if (spec.shape === 'round') {
        const r = spec.radius;
        const bandW = THREE.MathUtils.clamp(r * 0.28, 0.08, 0.14);

        pushGeo(spec.wrap, new THREE.CylinderGeometry(r, r, bodyH, 24), 0, bodyH * 0.5, 0);
        pushGeo(spec.wrap, new THREE.CylinderGeometry(r + 0.04, r + 0.04, lidH, 24), 0, spec.h - lidH * 0.5, 0);

        pushGeo(spec.ribbon, new THREE.BoxGeometry(r * 2 + 0.022, bodyH + 0.004, bandW), 0, bodyH * 0.5, 0);
        pushGeo(spec.ribbon, new THREE.BoxGeometry(bandW, bodyH + 0.004, r * 2 + 0.022), 0, bodyH * 0.5, 0);
        pushGeo(spec.ribbon, new THREE.BoxGeometry(r * 2 + 0.098, lidH + 0.016, bandW), 0, spec.h - lidH * 0.5, 0);
        pushGeo(spec.ribbon, new THREE.BoxGeometry(bandW, lidH + 0.016, r * 2 + 0.098), 0, spec.h - lidH * 0.5, 0);
        pushGeo(
          spec.ribbon,
          new THREE.CylinderGeometry(r + 0.046, r + 0.046, lidH * 0.32, 24),
          0,
          spec.h - lidH * 0.5,
          0
        );
      } else {
        const bandW = THREE.MathUtils.clamp(Math.min(spec.w, spec.d) * 0.17, 0.085, 0.16);

        pushGeo(spec.wrap, new THREE.BoxGeometry(spec.w, bodyH, spec.d), 0, bodyH * 0.5, 0);
        pushGeo(
          spec.wrap,
          new THREE.BoxGeometry(spec.w + 0.065, lidH, spec.d + 0.065),
          0,
          spec.h - lidH * 0.5,
          0
        );

        pushGeo(spec.ribbon, new THREE.BoxGeometry(spec.w + 0.022, bodyH + 0.004, bandW), 0, bodyH * 0.5, 0);
        pushGeo(spec.ribbon, new THREE.BoxGeometry(bandW, bodyH + 0.004, spec.d + 0.022), 0, bodyH * 0.5, 0);
        pushGeo(
          spec.ribbon,
          new THREE.BoxGeometry(spec.w + 0.086, lidH + 0.016, bandW),
          0,
          spec.h - lidH * 0.5,
          0
        );
        pushGeo(
          spec.ribbon,
          new THREE.BoxGeometry(bandW, lidH + 0.016, spec.d + 0.086),
          0,
          spec.h - lidH * 0.5,
          0
        );
      }

      if (!spec.hasTopStack) {
        const topY = spec.h + 0.01;
        const bowS =
          spec.shape === 'round'
            ? THREE.MathUtils.clamp(spec.radius * 0.44, 0.11, 0.22)
            : THREE.MathUtils.clamp(Math.min(spec.w, spec.d) * 0.25, 0.11, 0.24);

        const loopAngles = [0.42, -0.42, Math.PI + 0.42, Math.PI - 0.42];
        loopAngles.forEach((ang) => {
          const offsetR = bowS * 0.62;
          pushGeo(
            spec.ribbon,
            new THREE.TorusGeometry(bowS * 0.60, bowS * 0.21, 8, 16),
            Math.cos(ang) * offsetR,
            topY + bowS * 0.34,
            Math.sin(ang) * offsetR,
            0.22,
            -ang,
            0.32,
            1.12,
            0.76,
            0.85
          );
        });

        pushGeo(
          spec.ribbon,
          new THREE.SphereGeometry(bowS * 0.29, 10, 8),
          0,
          topY + bowS * 0.28,
          0,
          0,
          0,
          0,
          1.0,
          0.72,
          0.9
        );

        [-1, 1].forEach((dir) => {
          pushGeo(
            spec.ribbon,
            new THREE.BoxGeometry(bowS * 1.12, 0.018, bowS * 0.32),
            dir * bowS * 0.68,
            topY + 0.018,
            dir * bowS * 0.28,
            0,
            dir * -0.46,
            dir * -0.14
          );
        });

        if (spec.holly) {
          const hx = bowS * 0.56;
          const hz = bowS * 0.48;
          pushGeo(
            'hollyLeaf',
            new THREE.SphereGeometry(0.062, 6, 5),
            hx + 0.05,
            topY + 0.028,
            hz,
            0.12,
            0.38,
            -0.15,
            1.55,
            0.22,
            0.75
          );
          pushGeo(
            'hollyLeaf',
            new THREE.SphereGeometry(0.062, 6, 5),
            hx - 0.03,
            topY + 0.028,
            hz + 0.06,
            -0.14,
            1.28,
            0.12,
            1.55,
            0.22,
            0.75
          );
          [
            [hx + 0.01, topY + 0.048, hz + 0.02],
            [hx + 0.04, topY + 0.044, hz - 0.02],
            [hx - 0.02, topY + 0.044, hz + 0.04]
          ].forEach(([bx, by, bz]) => {
            pushGeo('hollyBerry', new THREE.SphereGeometry(0.030, 8, 6), bx, by, bz);
          });
        }

        tmpVec.set(0, topY + bowS * 0.58, 0).applyMatrix4(parentMatrix);
        this.sparklePoints.push({
          x: tmpVec.x,
          y: tmpVec.y,
          z: tmpVec.z,
          phase: idx * 0.73,
          size: 0.75 + (idx % 3) * 0.14
        });
      }

      if (baseOffset === 0) {
        const shadowW = spec.shape === 'round' ? spec.radius * 2.55 : spec.w * 1.38;
        const shadowD = spec.shape === 'round' ? spec.radius * 2.55 : spec.d * 1.38;
        pushGeo(
          'shadow',
          new THREE.PlaneGeometry(shadowW, shadowD),
          0,
          0.027,
          0,
          -Math.PI / 2,
          0,
          0
        );
      }
    });

    Object.entries(buckets).forEach(([key, list]) => {
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) return;

      const mesh = new THREE.Mesh(merged, this.materials[key]);
      mesh.renderOrder = key === 'shadow' ? 0 : 1;
      this.group.add(mesh);
    });
  }

  _buildSparkles() {
    const count = this.sparklePoints.length;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);

    this.sparklePoints.forEach((pt, i) => {
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
      phases[i] = pt.phase;
      sizes[i] = pt.size;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.sparkleUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uBeat: { value: 0 },
      uReveal: { value: 1.0 },
      uColor: { value: new THREE.Color('#ffe9b8') }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.sparkleUniforms,
      vertexShader: SPARKLE_VERTEX_SHADER,
      fragmentShader: SPARKLE_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.sparkleMesh = new THREE.Points(geo, mat);
    this.sparkleMesh.renderOrder = 3;
    this.group.add(this.sparkleMesh);
  }

  setColors(colors) {
    if (!colors) return;

    const primary = new THREE.Color(colors.treePrimary);
    primary.getHSL(this._tmpHsl);
    const clampedS = THREE.MathUtils.clamp(this._tmpHsl.s, 0.42, 0.68);
    const clampedL = THREE.MathUtils.clamp(this._tmpHsl.l, 0.30, 0.42);
    this.materials.wrapTheme.color.setHSL(this._tmpHsl.h, clampedS, clampedL);
    this.materials.wrapTheme.emissive.copy(this.materials.wrapTheme.color).multiplyScalar(0.28);

    const ribbonTint = new THREE.Color(colors.ribbonColor);
    this.materials.ribbonGold.color.copy(this._baseGold).lerp(ribbonTint, 0.28);
    this.materials.ribbonGold.color.getHSL(this._tmpHsl);
    if (this._tmpHsl.l > 0.68) {
      this.materials.ribbonGold.color.setHSL(this._tmpHsl.h, this._tmpHsl.s, 0.68);
    }
    this.materials.ribbonGold.emissive.copy(this.materials.ribbonGold.color).multiplyScalar(0.30);

    const secondaryTint = new THREE.Color(colors.treeSecondary);
    this.materials.ribbonSilver.color.copy(this._baseSilver).lerp(secondaryTint, 0.25);

    this.sparkleUniforms.uColor.value.copy(this._baseSparkle).lerp(ribbonTint, 0.35);
  }

  setReveal(stateOrNumber) {
    let active;
    let cascadeY;
    let edgeGlow;
    let groundP;

    if (typeof stateOrNumber === 'number') {
      const n = THREE.MathUtils.clamp(stateOrNumber, 0, 1);
      active = n < 0.999;
      cascadeY = n >= 0.999 ? -30 : 30;
      edgeGlow = 0;
      groundP = n;
    } else {
      ({
        active = false,
        cascadeY = -30,
        edgeGlow = 0,
        groundP = 1
      } = stateOrNumber);
    }

    this.cascadeUniforms.uCascadeActive.value = active ? 1 : 0;
    this.cascadeUniforms.uCascadeY.value = cascadeY;
    this.cascadeUniforms.uCascadeEdge.value = edgeGlow;

    const groundEase = THREE.MathUtils.smoothstep(groundP, 0, 1);
    this.shadowMat.opacity = 0.55 * groundEase;
    this.sparkleUniforms.uReveal.value = groundEase;
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  setBeat(beat) {
    this.sparkleUniforms.uBeat.value = beat;
  }

  setPixelRatio(ratio) {
    this.sparkleUniforms.uPixelRatio.value = ratio;
  }

  update(elapsed) {
    if (!this.group.visible) return;
    this.sparkleUniforms.uTime.value = elapsed;
  }
}
