/**
 * 3D 粒子烟花系统
 * --------------------------------------------------
 * 1. 自动在圣诞树左右后方的夜空周期绽放多色梦幻烟花（还原示例图左侧烟花氛围）
 * 2. 支持用户点击/轻触画面空白夜空，在点击位置即时绽放一朵专属烟花！
 */

import * as THREE from 'three';

const SPARKS_PER_BURST = 96;
const TRAIL_STEPS = 4; // 每根烟花射线带 4 个拖尾星点，呈现示例图中的虚线放射感
const POINTS_PER_BURST = SPARKS_PER_BURST * TRAIL_STEPS;
const MAX_BURSTS = 6;

const PALETTES = [
  ['#72efdd', '#ffd6a5', '#ff9ebb', '#ffffff'],
  ['#a8dadc', '#ffe599', '#f7b2d9', '#e0fbfc'],
  ['#ffd166', '#ff85b3', '#b8f2e6', '#fff8dc'],
  ['#c77dff', '#72efdd', '#ffd6e0', '#ffffff'],
  ['#90e0ef', '#ffd166', '#ffadad', '#f8f9fa']
];

class FireworkBurst {
  constructor(dotTexture) {
    this.active = false;
    this.age = 0;
    this.duration = 2.4;

    this.positions = new Float32Array(POINTS_PER_BURST * 3);
    this.colors = new Float32Array(POINTS_PER_BURST * 3);

    // 记录每根射线的初速度与颜色
    this.velocities = new Float32Array(SPARKS_PER_BURST * 3);
    this.sparkColors = [];
    this.origin = new THREE.Vector3();

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.34,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.visible = false;
  }

  trigger(origin, customTintHex = null) {
    this.active = true;
    this.age = 0;
    this.duration = 2.0 + Math.random() * 0.75;
    this.origin.copy(origin);
    this.points.visible = true;

    const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    const tint = customTintHex ? new THREE.Color(customTintHex) : null;
    this.sparkColors = [];

    const burstScale = 2.4 + Math.random() * 1.4;

    for (let s = 0; s < SPARKS_PER_BURST; s += 1) {
      // 球面均匀分布 + 略微偏向前方的扁球形绽放，让构图更饱满
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = burstScale * (0.48 + 0.56 * Math.random());

      this.velocities[s * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[s * 3 + 1] = Math.cos(phi) * speed;
      this.velocities[s * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.65;

      const baseColor = new THREE.Color(palette[s % palette.length]);
      if (tint && s % 3 === 0) {
        baseColor.lerp(tint, 0.45);
      }
      this.sparkColors.push(baseColor);
    }

    this._writeFrame(0.02);
  }

  _writeFrame(t) {
    const drag = 0.92;
    const gravity = -1.15;

    for (let s = 0; s < SPARKS_PER_BURST; s += 1) {
      const vx = this.velocities[s * 3];
      const vy = this.velocities[s * 3 + 1];
      const vz = this.velocities[s * 3 + 2];
      const col = this.sparkColors[s];

      for (let k = 0; k < TRAIL_STEPS; k += 1) {
        const idx = s * TRAIL_STEPS + k;
        const tk = Math.max(0, t - k * 0.065);
        // 空气阻力下的平滑扩散位移
        const factor = (1 - Math.pow(drag, tk * 18)) * 0.75;

        this.positions[idx * 3] = this.origin.x + vx * factor;
        this.positions[idx * 3 + 1] = this.origin.y + vy * factor + 0.5 * gravity * tk * tk;
        this.positions[idx * 3 + 2] = this.origin.z + vz * factor;

        const trailFade = 1 - k * 0.22;
        this.colors[idx * 3] = col.r * trailFade;
        this.colors[idx * 3 + 1] = col.g * trailFade;
        this.colors[idx * 3 + 2] = col.b * trailFade;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  update(delta) {
    if (!this.active) return;

    this.age += delta;
    if (this.age >= this.duration) {
      this.active = false;
      this.points.visible = false;
      this.material.opacity = 0;
      return;
    }

    const progress = this.age / this.duration;
    this._writeFrame(this.age);

    // 绽放瞬间最亮，后半段优雅闪烁消散
    const fadeIn = Math.min(1, progress * 7);
    const fadeOut = Math.pow(1 - progress, 1.35);
    const shimmer = 0.85 + 0.15 * Math.sin(this.age * 24);
    this.material.opacity = fadeIn * fadeOut * shimmer;
  }
}

export class FireworksSystem {
  constructor(dotTexture, themeTint) {
    this.group = new THREE.Group();
    this.enabled = true;
    this.themeTint = themeTint;
    this.bursts = [];
    this.nextAutoTimer = 0.55; // 打开页面半秒内就放第一朵烟花，第一时间带来惊喜！
    this.sideToggle = -1; // 左右交替绽放，首朵默认在左侧呼应示例图

    for (let i = 0; i < MAX_BURSTS; i += 1) {
      const burst = new FireworkBurst(dotTexture);
      this.bursts.push(burst);
      this.group.add(burst.points);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  setThemeTint(hex) {
    this.themeTint = hex;
  }

  /**
   * 在指定 3D 坐标立刻绽放一朵烟花（供自动定时或点击屏幕调用）
   */
  launchAt(x, y, z) {
    if (!this.enabled) return;
    let slot = this.bursts.find((b) => !b.active);
    if (!slot) {
      // 如果全在播放，复用最老的一朵
      slot = this.bursts.reduce((oldest, curr) => (curr.age > oldest.age ? curr : oldest));
    }
    slot.trigger(new THREE.Vector3(x, y, z), this.themeTint);
  }

  _launchAuto() {
    const side = this.sideToggle;
    this.sideToggle *= -1;
    const x = side * (3.7 + Math.random() * 2.8);
    const y = -0.3 + Math.random() * 4.4;
    const z = -4.2 - Math.random() * 3.0;
    this.launchAt(x, y, z);
  }

  update(delta) {
    if (!this.enabled) return;

    this.nextAutoTimer -= delta;
    if (this.nextAutoTimer <= 0) {
      this._launchAuto();
      this.nextAutoTimer = 1.9 + Math.random() * 1.5;
    }

    for (let i = 0; i < this.bursts.length; i += 1) {
      this.bursts[i].update(delta);
    }
  }
}
