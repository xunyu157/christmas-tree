/**
 * 开场「点亮圣诞树」13.4 秒交响式多幕粒子雾霾光效系统（IntroEffectSystem）
 * --------------------------------------------------
 * 节奏张弛有度，先在纯黑宇宙中凸显圣诞树诞生全过程，最后再用光波唤醒全部雪夜背景：
 * 1. 纯黑聚光（0.00 -> 2.00s）：中心光点渐亮、压缩环收束蓄能、微光向心汇聚；
 * 2. 雾霾爆开 + 停顿 1（2.00 -> 4.15s）：双冲击波引爆漫天粒子雾霾与 20 团星云柔雾，黑空中缓缓漂浮停顿；
 * 3. 从上往下形成灯带 + 停顿 2（4.15 -> 7.65s）：流星彗核与 40% 雾霾粒子绕树凝聚成流光金带，静赏悬空灯带；
 * 4. 剩余粒子环绕成树 + 停顿 3（7.65 -> 10.85s）：60% 粒子大尺度环绕旋涡塑成碎钻圣诞树，纯黑中独自闪耀片刻；
 * 5. 烟花破晓 · 光瀑倾泻（10.65 -> 14.05s）：第一波烟花先在黑空中绽放，化作漫天星辉微光自上而下倾洒照亮远山、松林、雪地与小镇。
 */

import * as THREE from 'three';

const TREE_HEIGHT = 10.35;
const TREE_BASE_Y = -4.18;
const TREE_BASE_RADIUS = 3.62;
const RIBBON_TURNS = 4.6;
const SEED_CENTER_Y = 2.2;

function getRibbonPoint(tHeight, outVec) {
  const t = THREE.MathUtils.clamp(tHeight, 0, 1);
  const angle = t * Math.PI * 2.0 * RIBBON_TURNS;
  const smoothCone = Math.pow(1.0 - t, 0.96) * TREE_BASE_RADIUS + 0.04;
  const r = smoothCone * 1.02 + 0.05;
  const y = TREE_BASE_Y + t * TREE_HEIGHT;
  outVec.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
  return outVec;
}

function getTreeBodyPoint(tHeight, angle, radialFactor, outVec) {
  const t = THREE.MathUtils.clamp(tHeight, 0.02, 0.98);
  const smoothCone = Math.pow(1.0 - t, 0.96) * TREE_BASE_RADIUS + 0.04;
  const r = smoothCone * radialFactor;
  const y = TREE_BASE_Y + t * TREE_HEIGHT;
  outVec.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
  return outVec;
}

function easeInOutQuad(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function easeInOutCubic(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function createShockwaveRingTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 250, 235, 0.0)');
  grad.addColorStop(0.6, 'rgba(255, 232, 180, 0.04)');
  grad.addColorStop(0.78, 'rgba(255, 240, 200, 0.72)');
  grad.addColorStop(0.86, 'rgba(255, 250, 235, 0.94)');
  grad.addColorStop(0.94, 'rgba(255, 214, 155, 0.36)');
  grad.addColorStop(1.0, 'rgba(255, 200, 140, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createHazeNebulaTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const blobs = [
    [128, 128, 114, 0.46],
    [94, 112, 82, 0.34],
    [164, 138, 84, 0.32],
    [124, 156, 76, 0.28],
    [140, 96, 70, 0.26]
  ];

  blobs.forEach(([x, y, r, alpha]) => {
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0.0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.45, `rgba(232, 240, 255, ${alpha * 0.48})`);
    grad.addColorStop(1.0, 'rgba(210, 224, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const HAZE_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aSoftness;
  attribute vec3 aColor;

  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vSoftness;

  void main() {
    vColor = aColor;
    vSoftness = aSoftness;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (135.0 / max(-mvPosition.z, 1.0));
  }
`;

const HAZE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vSoftness;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float crisp = exp(-dist * 10.5);
    float bokeh = pow(smoothstep(0.5, 0.0, dist), 2.2) * 0.44;
    float alpha = mix(crisp, bokeh, vSoftness);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export class IntroEffectSystem {
  constructor(colors, dotTexture, sparkleTexture, isMobile = false) {
    this.group = new THREE.Group();
    this.particleCount = isMobile ? 1300 : 2200;
    this.trailCount = isMobile ? 120 : 180;
    this.mainCount = this.particleCount - this.trailCount;
    this.ribbonShareCount = Math.floor(this.mainCount * 0.4);

    this.palette = {
      gold: new THREE.Color(colors.ribbonColor),
      whiteGold: new THREE.Color('#fff7de'),
      primary: new THREE.Color(colors.treePrimary),
      iceWhite: new THREE.Color(colors.treeSecondary).lerp(new THREE.Color('#dceeff'), 0.45)
    };

    // 1. 中心渐亮星核（光芯 + 旋转四角星芒 + 外晕）
    this.seedGroup = new THREE.Group();
    this.seedGroup.position.set(0, SEED_CENTER_Y, 0);

    this.coreMat = new THREE.SpriteMaterial({
      map: dotTexture,
      color: new THREE.Color('#fffaf0'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.coreSprite = new THREE.Sprite(this.coreMat);
    this.coreSprite.renderOrder = 61;

    this.flareMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color('#ffe7b3'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.flareSprite = new THREE.Sprite(this.flareMat);
    this.flareSprite.renderOrder = 62;

    this.haloMat = new THREE.SpriteMaterial({
      map: dotTexture,
      color: new THREE.Color(colors.ribbonColor),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.haloSprite = new THREE.Sprite(this.haloMat);
    this.haloSprite.renderOrder = 60;

    this.seedGroup.add(this.haloSprite);
    this.seedGroup.add(this.coreSprite);
    this.seedGroup.add(this.flareSprite);
    this.group.add(this.seedGroup);

    // 2. 蓄能收缩环 + 爆发双冲击波（径向爆炸光环 + 3D 横扫赤道波）
    const shockTex = createShockwaveRingTexture();

    this.chargeRingMat = new THREE.SpriteMaterial({
      map: shockTex,
      color: new THREE.Color('#ffd991'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.chargeRing = new THREE.Sprite(this.chargeRingMat);
    this.chargeRing.position.set(0, SEED_CENTER_Y, 0);
    this.chargeRing.renderOrder = 58;
    this.group.add(this.chargeRing);

    this.shockMat = new THREE.SpriteMaterial({
      map: shockTex,
      color: new THREE.Color('#ffebc4'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.shockMesh = new THREE.Sprite(this.shockMat);
    this.shockMesh.position.set(0, SEED_CENTER_Y, 0);
    this.shockMesh.renderOrder = 59;
    this.group.add(this.shockMesh);

    this.equatorMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffe5b0'),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.equatorRing = new THREE.Mesh(new THREE.RingGeometry(0.84, 1.0, 72), this.equatorMat);
    this.equatorRing.position.set(0, SEED_CENTER_Y, 0);
    this.equatorRing.rotation.set(Math.PI * 0.46, 0.12, 0.18);
    this.equatorRing.renderOrder = 59;
    this.group.add(this.equatorRing);

    // 3. 烟花破晓自上而下倾泻的星辉微光雨（10.72 -> 13.85s 从高空飘落至远山、松林与雪地）
    this.skyCascadeCount = isMobile ? 150 : 240;
    this.skyCascadePositions = new Float32Array(this.skyCascadeCount * 3);
    this.skyCascadeColors = new Float32Array(this.skyCascadeCount * 3);
    this.skyCascadeItems = [];

    for (let i = 0; i < this.skyCascadeCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 5.0 + Math.random() * 23.0;
      this.skyCascadeItems.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        startY: 7.0 + Math.random() * 9.5,
        endY: -4.5 + Math.random() * 1.4,
        delay: Math.random() * 0.34,
        dur: 0.5 + Math.random() * 0.22,
        driftAmp: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        goldMix: Math.random() < 0.5 ? 0.65 : 0.15
      });
    }

    const skyCascadeGeo = new THREE.BufferGeometry();
    skyCascadeGeo.setAttribute('position', new THREE.BufferAttribute(this.skyCascadePositions, 3));
    skyCascadeGeo.setAttribute('color', new THREE.BufferAttribute(this.skyCascadeColors, 3));

    const skyCascadeMat = new THREE.PointsMaterial({
      size: 0.34,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      fog: false
    });
    this.skyCascadeMesh = new THREE.Points(skyCascadeGeo, skyCascadeMat);
    this.skyCascadeMesh.renderOrder = 8;
    this.skyCascadeMesh.frustumCulled = false;
    this.skyCascadeMesh.visible = false;
    this.group.add(this.skyCascadeMesh);

    // 4. 20 团星云微雾光团（开启真实 3D 深度测试，在纯黑天际营造浓郁粒子雾霾纵深）
    const hazeTex = createHazeNebulaTexture();
    this.hazeClouds = [];
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const radius = 4.0 + Math.random() * 11.0;
      const y = -1.5 + Math.random() * 11.0;
      const colorRole = i % 3;
      const mat = new THREE.SpriteMaterial({
        map: hazeTex,
        color: new THREE.Color(
          colorRole === 0
            ? colors.ribbonColor
            : colorRole === 1
              ? colors.treePrimary
              : colors.treeSecondary
        ),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        fog: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(0, SEED_CENTER_Y, 0);
      sprite.renderOrder = 4;
      sprite.userData = {
        angle: a,
        radius,
        y,
        orbitSpeed: 0.11 + Math.random() * 0.13,
        peakScale: 8.0 + Math.random() * 8.0,
        peakOpacity: 0.065 + Math.random() * 0.06,
        colorRole,
        bobPhase: Math.random() * Math.PI * 2
      };
      this.hazeClouds.push(sprite);
      this.group.add(sprite);
    }

    // 5. 2200 粒变尺光斑雾霾粒子（真实 3D 遮挡穿插绕树）
    this.burstPositions = new Float32Array(this.particleCount * 3);
    this.burstColors = new Float32Array(this.particleCount * 3);
    this.burstSizes = new Float32Array(this.particleCount);
    this.burstSoftness = new Float32Array(this.particleCount);
    this.particles = [];

    const chargeLimit = Math.floor(this.mainCount * 0.22);
    for (let i = 0; i < this.particleCount; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(theta);

      const isCometTrail = i >= this.mainCount;
      const isRibbonShare = !isCometTrail && i < this.ribbonShareCount;
      const isBokeh = !isCometTrail && Math.random() < 0.38;

      let shareNorm = 0;
      if (isRibbonShare) {
        shareNorm = i / Math.max(1, this.ribbonShareCount - 1);
      } else if (!isCometTrail) {
        shareNorm = (i - this.ribbonShareCount) / Math.max(1, this.mainCount - this.ribbonShareCount - 1);
      }

      this.burstSizes[i] = isCometTrail
        ? 0.45 + Math.random() * 0.45
        : isBokeh
          ? 1.3 + Math.random() * 1.4
          : 0.38 + Math.random() * 0.67;
      this.burstSoftness[i] = isCometTrail
        ? 0.18
        : isBokeh
          ? 0.85 + Math.random() * 0.15
          : 0.1 + Math.random() * 0.25;

      this.particles.push({
        dx,
        dy,
        dz,
        burstDist: 4.8 + Math.random() * 14.2,
        inwardDist: 1.8 + Math.random() * 3.4,
        isChargeMote: !isCometTrail && i < chargeLimit,
        isCometTrail,
        isRibbonShare,
        isBokeh,
        targetT: THREE.MathUtils.clamp(0.96 - shareNorm * 0.92 + (Math.random() - 0.5) * 0.04, 0.03, 0.97),
        treeAngle: Math.random() * Math.PI * 2,
        treeRadial: 0.68 + Math.random() * 0.34,
        swirlOffset: (Math.random() - 0.5) * 1.2,
        radialSpread: (Math.random() - 0.5) * 0.3,
        heightSpread: (Math.random() - 0.5) * 0.24,
        orbitSpeed: 0.18 + Math.random() * 0.2,
        role: i % 4,
        phase: Math.random() * Math.PI * 2,
        trailFrac: isCometTrail ? (i - this.mainCount) / Math.max(1, this.trailCount) : 0
      });
    }

    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(this.burstPositions, 3));
    burstGeo.setAttribute('aColor', new THREE.BufferAttribute(this.burstColors, 3));
    burstGeo.setAttribute('aSize', new THREE.BufferAttribute(this.burstSizes, 1));
    burstGeo.setAttribute('aSoftness', new THREE.BufferAttribute(this.burstSoftness, 1));

    this.burstUniforms = {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
    };

    this.burstMat = new THREE.ShaderMaterial({
      uniforms: this.burstUniforms,
      vertexShader: HAZE_VERTEX_SHADER,
      fragmentShader: HAZE_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      fog: false
    });
    this.burstMesh = new THREE.Points(burstGeo, this.burstMat);
    this.burstMesh.renderOrder = 5;
    this.burstMesh.frustumCulled = false;
    this.group.add(this.burstMesh);

    // 6. 从上往下环绕点亮灯带的流星彗核头
    this.cometGroup = new THREE.Group();
    this.cometCoreMat = new THREE.SpriteMaterial({
      map: dotTexture,
      color: new THREE.Color('#fff9e2'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      fog: false
    });
    this.cometCore = new THREE.Sprite(this.cometCoreMat);
    this.cometCore.scale.set(2.3, 2.3, 1);
    this.cometCore.renderOrder = 6;

    this.cometFlareMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color(colors.ribbonColor),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      fog: false
    });
    this.cometFlare = new THREE.Sprite(this.cometFlareMat);
    this.cometFlare.scale.set(3.8, 3.8, 1);
    this.cometFlare.renderOrder = 7;

    this.cometGroup.add(this.cometCore);
    this.cometGroup.add(this.cometFlare);
    this.group.add(this.cometGroup);

    this._tmpTarget = new THREE.Vector3();
    this._tmpCol = new THREE.Color();
  }

  _getRoleColor(role, out) {
    if (role === 0) return out.copy(this.palette.gold);
    if (role === 1) return out.copy(this.palette.whiteGold);
    if (role === 2) return out.copy(this.palette.primary);
    return out.copy(this.palette.iceWhite);
  }

  setColors(colors) {
    this.palette.gold.set(colors.ribbonColor);
    this.palette.primary.set(colors.treePrimary);
    this.palette.iceWhite.set(colors.treeSecondary).lerp(new THREE.Color('#dceeff'), 0.45);
    this.haloMat.color.set(colors.ribbonColor);
    this.cometFlareMat.color.set(colors.ribbonColor);

    this.hazeClouds.forEach((sprite) => {
      const r = sprite.userData.colorRole;
      sprite.material.color.set(
        r === 0 ? colors.ribbonColor : r === 1 ? colors.treePrimary : colors.treeSecondary
      );
    });
  }

  setPixelRatio(ratio) {
    this.burstUniforms.uPixelRatio.value = ratio;
  }

  syncCamera() {}

  setIdle() {
    this.group.visible = true;
    this.seedGroup.visible = false;
    this.chargeRing.visible = false;
    this.shockMesh.visible = false;
    this.equatorRing.visible = false;
    this.skyCascadeMesh.visible = false;
    this.burstMesh.visible = false;
    this.cometGroup.visible = false;
    this.hazeClouds.forEach((s) => {
      s.visible = false;
    });
  }

  setFinished() {
    this.seedGroup.visible = false;
    this.chargeRing.visible = false;
    this.shockMesh.visible = false;
    this.equatorRing.visible = false;
    this.skyCascadeMesh.visible = false;
    this.burstMesh.visible = false;
    this.cometGroup.visible = false;
    this.hazeClouds.forEach((s) => {
      s.visible = false;
    });
    this.group.visible = false;
  }

  updateIntro(elapsed) {
    this.group.visible = true;

    // A. 中心渐亮星核与外圈向内压缩聚能环（Act 1: 0.00 -> 2.00s）
    if (elapsed >= 0.55 && elapsed <= 2.02) {
      const cp = THREE.MathUtils.clamp((elapsed - 0.55) / 1.43, 0, 1);
      const scale = THREE.MathUtils.lerp(6.6, 0.25, Math.pow(cp, 1.35));
      this.chargeRing.visible = true;
      this.chargeRing.scale.set(scale, scale, 1);
      const fadeIn = THREE.MathUtils.clamp((elapsed - 0.55) / 0.4, 0, 1);
      this.chargeRingMat.opacity = fadeIn * (0.28 + 0.54 * cp);
    } else {
      this.chargeRing.visible = false;
    }

    if (elapsed < 2.55) {
      this.seedGroup.visible = true;
      if (elapsed < 2.0) {
        const p = THREE.MathUtils.clamp((elapsed - 0.06) / 1.94, 0, 1);
        const glow = Math.pow(p, 1.75);
        const surge = elapsed > 1.84 ? ((elapsed - 1.84) / 0.16) * 1.55 : 0;

        this.coreSprite.scale.setScalar(0.05 + glow * 2.45 + surge);
        this.coreMat.opacity = Math.min(1, 0.08 + glow * 0.92);

        this.flareSprite.scale.setScalar(0.1 + glow * 5.8 + surge * 2.0);
        this.flareMat.opacity = Math.min(1, 0.05 + glow * 0.92);
        this.flareMat.rotation = elapsed * 0.72;

        this.haloSprite.scale.setScalar(0.2 + glow * 6.8 + surge * 2.2);
        this.haloMat.opacity = glow * 0.52;
      } else {
        const fade = THREE.MathUtils.clamp(1 - (elapsed - 2.0) / 0.55, 0, 1);
        const flashBurst = elapsed < 2.16 ? 1 + Math.sin(((elapsed - 2.0) / 0.16) * Math.PI) * 0.55 : 1;
        this.coreSprite.scale.setScalar(4.0 * fade * flashBurst);
        this.coreMat.opacity = fade * fade;
        this.flareSprite.scale.setScalar(7.8 * (0.4 + 0.6 * fade));
        this.flareMat.opacity = fade * 0.88;
        this.flareMat.rotation = elapsed * 0.95;
        this.haloSprite.scale.setScalar(9.0 * (1.2 - 0.2 * fade));
        this.haloMat.opacity = fade * fade * 0.44;
      }
    } else {
      this.seedGroup.visible = false;
    }

    // B. 双冲击波爆开特效（Act 2: 2.00s 引爆）
    if (elapsed >= 2.0 && elapsed <= 3.15) {
      const rp = (elapsed - 2.0) / 1.15;
      const ringScale = 0.4 + Math.pow(rp, 0.7) * 21.6;
      this.shockMesh.visible = true;
      this.shockMesh.scale.set(ringScale, ringScale, 1);
      this.shockMat.opacity = 0.9 * Math.pow(1 - rp, 1.8);
    } else {
      this.shockMesh.visible = false;
    }

    if (elapsed >= 2.0 && elapsed <= 3.25) {
      const ep = (elapsed - 2.0) / 1.25;
      const eqScale = 0.3 + Math.pow(ep, 0.72) * 24.7;
      this.equatorRing.visible = true;
      this.equatorRing.scale.setScalar(eqScale);
      this.equatorMat.opacity = 0.78 * Math.pow(1 - ep, 1.85);
    } else {
      this.equatorRing.visible = false;
    }

    // C. 烟花光瀑倾泻微光雨（Act 4: 10.72 -> 13.85s 从高空温柔飘洒至群山、松林与雪地）
    if (elapsed >= 10.72 && elapsed <= 13.85) {
      const p = (elapsed - 10.72) / 3.13;
      this.skyCascadeMesh.visible = true;

      for (let i = 0; i < this.skyCascadeCount; i += 1) {
        const m = this.skyCascadeItems[i];
        const localP = THREE.MathUtils.clamp((p - m.delay) / m.dur, 0, 1);
        const y = THREE.MathUtils.lerp(m.startY, m.endY, easeInOutQuad(localP));
        const swayX = Math.sin(elapsed * 2.2 + m.phase) * m.driftAmp;
        const swayZ = Math.cos(elapsed * 1.9 + m.phase) * m.driftAmp;

        this.skyCascadePositions[i * 3] = m.x + swayX;
        this.skyCascadePositions[i * 3 + 1] = y;
        this.skyCascadePositions[i * 3 + 2] = m.z + swayZ;

        const alpha =
          localP > 0 && localP < 1
            ? Math.sin(localP * Math.PI) * (0.62 + 0.38 * Math.sin(elapsed * 8.0 + m.phase))
            : 0;
        this._tmpCol.copy(this.palette.iceWhite).lerp(this.palette.gold, m.goldMix);
        this.skyCascadeColors[i * 3] = this._tmpCol.r * alpha;
        this.skyCascadeColors[i * 3 + 1] = this._tmpCol.g * alpha;
        this.skyCascadeColors[i * 3 + 2] = this._tmpCol.b * alpha;
      }

      this.skyCascadeMesh.geometry.attributes.position.needsUpdate = true;
      this.skyCascadeMesh.geometry.attributes.color.needsUpdate = true;
    } else {
      this.skyCascadeMesh.visible = false;
    }

    // D. 20 团星云微雾（2.00s 爆开 -> 停顿 1~2 期优雅漂浮 -> 7.75..10.35s 随树体环绕收敛）
    if (elapsed >= 2.0 && elapsed <= 10.55) {
      const dt = elapsed - 2.0;
      const burstEase = 1 - Math.pow(1 - THREE.MathUtils.clamp(dt / 1.4, 0, 1), 3);
      const gatherP = easeInOutCubic((elapsed - 7.75) / 2.6);
      const enterFade = THREE.MathUtils.clamp(dt / 0.4, 0, 1);
      const exitFade = elapsed > 9.65 ? THREE.MathUtils.clamp(1 - (elapsed - 9.65) / 0.9, 0, 1) : 1;

      for (let i = 0; i < this.hazeClouds.length; i += 1) {
        const s = this.hazeClouds[i];
        const d = s.userData;
        s.visible = true;

        const a = d.angle + dt * d.orbitSpeed + gatherP * 2.4;
        const currR = d.radius * burstEase * (1 - gatherP * 0.88);
        const currY = THREE.MathUtils.lerp(
          SEED_CENTER_Y,
          d.y + Math.sin(elapsed * 0.85 + d.bobPhase) * 0.45,
          burstEase
        );
        const finalY = THREE.MathUtils.lerp(currY, 1.5, gatherP * 0.85);

        s.position.set(Math.cos(a) * currR, finalY, Math.sin(a) * currR);
        const currScale = d.peakScale * (0.12 + 0.88 * burstEase) * (1 - gatherP * 0.75);
        s.scale.set(currScale, currScale, 1);
        s.material.opacity = d.peakOpacity * enterFade * exitFade * (1 - gatherP * 0.65);
      }
    } else {
      for (let i = 0; i < this.hazeClouds.length; i += 1) {
        this.hazeClouds[i].visible = false;
      }
    }

    // E. 流星灯带彗核头（Act 3A: 4.15 -> 7.05s 从树梢一路螺旋点亮至树底，赶在停顿 2 前退场）
    const ribbonP = THREE.MathUtils.clamp((elapsed - 4.15) / 2.9, 0, 1);
    const tHead = 0.98 - easeInOutQuad(ribbonP) * 0.96;

    if (elapsed >= 4.1 && elapsed <= 7.25) {
      this.cometGroup.visible = true;
      getRibbonPoint(tHead, this._tmpTarget);
      this.cometGroup.position.copy(this._tmpTarget);

      const enterFade = THREE.MathUtils.clamp((elapsed - 4.1) / 0.22, 0, 1);
      const exitFade = elapsed > 6.9 ? THREE.MathUtils.clamp(1 - (elapsed - 6.9) / 0.35, 0, 1) : 1;
      const alpha = enterFade * exitFade;
      const pulse = 1 + 0.18 * Math.sin(elapsed * 22);

      this.cometCore.scale.setScalar(2.3 * pulse);
      this.cometCoreMat.opacity = alpha * 0.95;
      this.cometFlare.scale.setScalar(3.8 * pulse);
      this.cometFlareMat.opacity = alpha * 0.92;
      this.cometFlareMat.rotation = elapsed * 2.4;
    } else {
      this.cometGroup.visible = false;
    }

    // F. 2200 粒光斑雾霾粒子（含 停顿 1 / 停顿 2 的舒缓漂浮留白）
    if (elapsed >= 0.08 && elapsed <= 10.65) {
      this.burstMesh.visible = true;
      const trailActive = elapsed >= 4.15 && elapsed <= 7.15;

      for (let i = 0; i < this.particleCount; i += 1) {
        const p = this.particles[i];
        let px = 0;
        let py = SEED_CENTER_Y;
        let pz = 0;
        let brightness = 0;

        if (p.isCometTrail) {
          if (trailActive) {
            const trailStep = (p.trailFrac + ((elapsed * 1.45) % 1)) % 1;
            const tt = THREE.MathUtils.clamp(tHead + 0.008 + trailStep * 0.095, 0.01, 0.99);
            getRibbonPoint(tt, this._tmpTarget);
            const spread = 0.08 + trailStep * 0.46;
            px = this._tmpTarget.x + p.dx * spread;
            py = this._tmpTarget.y + p.dy * spread * 0.72;
            pz = this._tmpTarget.z + p.dz * spread;
            brightness = Math.pow(1 - trailStep, 1.4) * (0.72 + 0.28 * Math.sin(elapsed * 18 + p.phase));
            this._tmpCol.copy(p.role % 2 === 0 ? this.palette.gold : this.palette.whiteGold);
          }
        } else if (elapsed < 2.0) {
          if (p.isChargeMote) {
            const cp = (elapsed * 0.72 + p.phase / (Math.PI * 2)) % 1;
            const r = p.inwardDist * Math.pow(1 - cp, 1.4);
            const spin = cp * 2.6 + p.phase;
            px = (p.dx * Math.cos(spin) - p.dz * Math.sin(spin)) * r;
            py = SEED_CENTER_Y + p.dy * r;
            pz = (p.dx * Math.sin(spin) + p.dz * Math.cos(spin)) * r;
            brightness = Math.sin(cp * Math.PI) * 0.85 * THREE.MathUtils.clamp(elapsed / 0.65, 0, 1);
          }
          this._getRoleColor(p.role, this._tmpCol);
        } else {
          const dt = elapsed - 2.0;
          const explodeR = p.burstDist * (1 - Math.exp(-dt * 2.35));
          const driftAngle = dt * p.orbitSpeed;
          const cd = Math.cos(driftAngle);
          const sd = Math.sin(driftAngle);
          const bx = (p.dx * cd - p.dz * sd) * explodeR;
          const by = SEED_CENTER_Y + p.dy * explodeR * 0.78 + Math.sin(elapsed * 1.8 + p.phase) * 0.35;
          const bz = (p.dx * sd + p.dz * cd) * explodeR;
          const burstPop = Math.min(1, dt * 5.2);
          const bokehSoft = p.isBokeh ? 0.58 : 1.0;

          if (p.isRibbonShare) {
            // 阶段 3A（4.15 -> 7.05s）：40% 雾霾粒子按从上往下顺序旋涡聚拢到金色灯带
            const arriveTime = 4.15 + (1.0 - p.targetT) * 2.85;
            const convWindow = 1.15;
            const convRaw = (elapsed - (arriveTime - convWindow)) / convWindow;

            if (convRaw <= 0) {
              px = bx;
              py = by;
              pz = bz;
              const shimmer = 0.7 + 0.3 * Math.sin(elapsed * 7.5 + p.phase);
              brightness = burstPop * shimmer * bokehSoft;
              this._getRoleColor(p.role, this._tmpCol);
            } else if (convRaw < 1) {
              const ease = easeInOutCubic(convRaw);
              getRibbonPoint(p.targetT, this._tmpTarget);
              const tx = this._tmpTarget.x + p.radialSpread * 0.42;
              const ty = this._tmpTarget.y + p.heightSpread * 0.42;
              const tz = this._tmpTarget.z + p.radialSpread * 0.42;

              const swirl = (1 - ease) * (2.8 + p.swirlOffset);
              const cs = Math.cos(swirl);
              const sn = Math.sin(swirl);
              const mx = THREE.MathUtils.lerp(bx, tx, ease);
              const my = THREE.MathUtils.lerp(by, ty, ease);
              const mz = THREE.MathUtils.lerp(bz, tz, ease);
              px = mx * cs - mz * sn;
              py = my;
              pz = mx * sn + mz * cs;

              brightness = (0.78 + 0.38 * ease) * (p.isBokeh ? 0.65 : 1.0);
              this._getRoleColor(p.role, this._tmpCol).lerp(this.palette.gold, ease * 0.88);
            } else {
              const after = elapsed - arriveTime;
              getRibbonPoint(p.targetT, this._tmpTarget);
              px = this._tmpTarget.x + p.radialSpread * 0.32;
              py = this._tmpTarget.y + p.heightSpread * 0.32;
              pz = this._tmpTarget.z + p.radialSpread * 0.32;

              brightness = Math.max(0, 1.15 - after * 2.6) * (p.isBokeh ? 0.5 : 1.0);
              this._tmpCol.copy(this.palette.gold).lerp(this.palette.whiteGold, 0.35);
            }
          } else {
            // 阶段 3B（7.65 -> 10.35s）：剩余 60% 粒子经历停顿后大尺度环绕旋涡汇入圣诞树本体
            const startTime = 7.65 + (1.0 - p.targetT) * 1.1;
            const gatherDur = 1.65;
            const gatherRaw = (elapsed - startTime) / gatherDur;

            if (gatherRaw <= 0) {
              px = bx;
              py = by;
              pz = bz;
              const shimmer = 0.68 + 0.32 * Math.sin(elapsed * 7.0 + p.phase);
              brightness = burstPop * shimmer * bokehSoft;
              this._getRoleColor(p.role, this._tmpCol);
            } else if (gatherRaw < 1) {
              const ease = easeInOutCubic(gatherRaw);
              getTreeBodyPoint(p.targetT, p.treeAngle, p.treeRadial, this._tmpTarget);

              const swirl = (1 - ease) * (4.4 + p.swirlOffset);
              const cs = Math.cos(swirl);
              const sn = Math.sin(swirl);
              const mx = THREE.MathUtils.lerp(bx, this._tmpTarget.x, ease);
              const my = THREE.MathUtils.lerp(by, this._tmpTarget.y, ease);
              const mz = THREE.MathUtils.lerp(bz, this._tmpTarget.z, ease);
              px = mx * cs - mz * sn;
              py = my;
              pz = mx * sn + mz * cs;

              brightness = (0.76 + 0.42 * Math.sin(ease * Math.PI * 0.8)) * (p.isBokeh ? 0.68 : 1.0);
              this._getRoleColor(p.role, this._tmpCol);
            } else {
              const after = elapsed - (startTime + gatherDur);
              getTreeBodyPoint(p.targetT, p.treeAngle, p.treeRadial, this._tmpTarget);
              px = this._tmpTarget.x;
              py = this._tmpTarget.y;
              pz = this._tmpTarget.z;
              brightness = Math.max(0, 1.05 * (1 - after / 0.25)) * (p.isBokeh ? 0.55 : 1.0);
              this._getRoleColor(p.role, this._tmpCol).lerp(this.palette.whiteGold, 0.35);
            }
          }
        }

        this.burstPositions[i * 3] = px;
        this.burstPositions[i * 3 + 1] = py;
        this.burstPositions[i * 3 + 2] = pz;

        this.burstColors[i * 3] = this._tmpCol.r * brightness;
        this.burstColors[i * 3 + 1] = this._tmpCol.g * brightness;
        this.burstColors[i * 3 + 2] = this._tmpCol.b * brightness;
      }

      this.burstMesh.geometry.attributes.position.needsUpdate = true;
      this.burstMesh.geometry.attributes.aColor.needsUpdate = true;
    } else {
      this.burstMesh.visible = false;
    }
  }
}
