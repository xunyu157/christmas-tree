/**
 * 开场「点亮圣诞树」多幕 3D 光效系统（IntroEffectSystem）
 * --------------------------------------------------
 * 串联 4 幕震撼开场视觉：
 * 1. 全黑夜幕下，画面中央一点暖金星光逐渐亮起、星芒旋转、吸聚周边微光；
 * 2. 星核爆发成 900 粒璀璨光尘并伴随扩散光环，同时黑幕散开、显露整个雪夜星空与群山小镇；
 * 3. 光效粒子化作旋涡金流，聚成一颗流星灯带从树梢至树底沿螺旋轨道绕树点亮；
 * 4. 圣诞树碎钻本体自上而下显现、树底星河荡漾开来，无缝交棒给绚丽烟花收尾。
 */

import * as THREE from 'three';

const TREE_HEIGHT = 10.5;
const TREE_BASE_Y = -4.35;
const TREE_BASE_RADIUS = 3.85;
const RIBBON_TURNS = 4.6;
const SEED_CENTER_Y = 2.2;

function getRibbonPoint(tHeight, outVec) {
  const t = THREE.MathUtils.clamp(tHeight, 0, 1);
  const angle = t * Math.PI * 2.0 * RIBBON_TURNS;
  const smoothCone = Math.pow(1.0 - t, 0.91) * TREE_BASE_RADIUS + 0.06;
  const r = smoothCone * 1.06 + 0.05;
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
  grad.addColorStop(0.62, 'rgba(255, 232, 180, 0.04)');
  grad.addColorStop(0.78, 'rgba(255, 240, 200, 0.72)');
  grad.addColorStop(0.86, 'rgba(255, 250, 235, 0.92)');
  grad.addColorStop(0.94, 'rgba(255, 214, 155, 0.36)');
  grad.addColorStop(1.0, 'rgba(255, 200, 140, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class IntroEffectSystem {
  constructor(colors, dotTexture, sparkleTexture, isMobile = false) {
    this.group = new THREE.Group();
    this.particleCount = isMobile ? 620 : 900;
    this.trailCount = isMobile ? 80 : 110;
    this.mainCount = this.particleCount - this.trailCount;

    this.palette = {
      gold: new THREE.Color(colors.ribbonColor),
      whiteGold: new THREE.Color('#fff7de'),
      primary: new THREE.Color(colors.treePrimary),
      iceWhite: new THREE.Color(colors.treeSecondary).lerp(new THREE.Color('#dceeff'), 0.45)
    };

    // 1. 包裹相机的全黑遮罩穹顶（负责“最开始全黑 -> 爆开刹那散去显现背景”）
    this.blackoutMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 1.0,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false
    });
    this.blackoutDome = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8), this.blackoutMat);
    this.blackoutDome.renderOrder = 50;
    this.blackoutDome.frustumCulled = false;
    this.group.add(this.blackoutDome);

    // 2. 中心渐亮星核（光芯 + 旋转四角星芒 + 外晕）
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

    // 3. 粒子爆开瞬间向外扩散的冲击光环
    const shockTex = createShockwaveRingTexture();
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

    // 4. 900 粒多阶段光效粒子（蓄能吸聚 -> 爆开漫天光尘 -> 旋涡汇入从上往下螺旋灯带 + 彗尾拖影）
    this.burstPositions = new Float32Array(this.particleCount * 3);
    this.burstColors = new Float32Array(this.particleCount * 3);
    this.particles = [];

    const chargeLimit = Math.floor(this.mainCount * 0.22);
    for (let i = 0; i < this.particleCount; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(theta);

      const isCometTrail = i >= this.mainCount;
      const mainNorm = isCometTrail ? Math.random() : i / Math.max(1, this.mainCount - 1);

      this.particles.push({
        dx,
        dy,
        dz,
        burstDist: 5.5 + Math.random() * 9.3,
        inwardDist: 1.6 + Math.random() * 2.8,
        isChargeMote: !isCometTrail && i < chargeLimit,
        isCometTrail,
        targetT: 0.96 - mainNorm * 0.92 + (Math.random() - 0.5) * 0.025,
        swirlOffset: (Math.random() - 0.5) * 0.9,
        radialSpread: (Math.random() - 0.5) * 0.28,
        heightSpread: (Math.random() - 0.5) * 0.22,
        role: i % 4,
        phase: Math.random() * Math.PI * 2,
        trailFrac: isCometTrail ? (i - this.mainCount) / Math.max(1, this.trailCount) : 0
      });
    }

    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(this.burstPositions, 3));
    burstGeo.setAttribute('color', new THREE.BufferAttribute(this.burstColors, 3));

    this.burstMat = new THREE.PointsMaterial({
      size: 0.42,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.burstMesh = new THREE.Points(burstGeo, this.burstMat);
    this.burstMesh.renderOrder = 60;
    this.burstMesh.frustumCulled = false;
    this.group.add(this.burstMesh);

    // 5. 从上往下环绕点亮灯带的流星彗核头（核心光斑 + 旋转星芒）
    this.cometGroup = new THREE.Group();
    this.cometCoreMat = new THREE.SpriteMaterial({
      map: dotTexture,
      color: new THREE.Color('#fff9e2'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.cometCore = new THREE.Sprite(this.cometCoreMat);
    this.cometCore.scale.set(2.1, 2.1, 1);
    this.cometCore.renderOrder = 62;

    this.cometFlareMat = new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: new THREE.Color('#ffe08c'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.cometFlare = new THREE.Sprite(this.cometFlareMat);
    this.cometFlare.scale.set(3.4, 3.4, 1);
    this.cometFlare.renderOrder = 63;

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
  }

  syncCamera(camera) {
    if (camera) {
      this.blackoutDome.position.copy(camera.position);
    }
  }

  setIdle(camera) {
    this.group.visible = true;
    this.syncCamera(camera);

    this.blackoutDome.visible = true;
    this.blackoutMat.opacity = 1.0;

    this.seedGroup.visible = false;
    this.shockMesh.visible = false;
    this.burstMesh.visible = false;
    this.cometGroup.visible = false;
  }

  setFinished() {
    this.blackoutDome.visible = false;
    this.seedGroup.visible = false;
    this.shockMesh.visible = false;
    this.burstMesh.visible = false;
    this.cometGroup.visible = false;
    this.group.visible = false;
  }

  updateIntro(elapsed, camera) {
    this.group.visible = true;
    this.syncCamera(camera);

    // A. 黑幕揭晓控制：0..1.40s 纯黑 -> 1.40..2.32s 随爆发迅捷褪去显现全部雪夜群山星空背景
    if (elapsed < 1.4) {
      this.blackoutDome.visible = true;
      this.blackoutMat.opacity = 1.0;
    } else if (elapsed < 2.32) {
      const p = (elapsed - 1.4) / 0.92;
      this.blackoutDome.visible = true;
      this.blackoutMat.opacity = Math.pow(1 - p, 2.2);
    } else {
      this.blackoutDome.visible = false;
      this.blackoutMat.opacity = 0;
    }

    // 黑幕覆盖阶段用 depthTest: false 渲染在最前；背景完全揭晓后切回深度测试让粒子真实环绕树身
    if (elapsed < 2.25) {
      this.burstMat.depthTest = false;
      this.burstMesh.renderOrder = 60;
      this.cometCoreMat.depthTest = false;
      this.cometFlareMat.depthTest = false;
    } else {
      this.burstMat.depthTest = true;
      this.burstMesh.renderOrder = 5;
      this.cometCoreMat.depthTest = true;
      this.cometFlareMat.depthTest = true;
      this.cometCore.renderOrder = 6;
      this.cometFlare.renderOrder = 7;
    }

    // B. 中心渐亮光点（Act 1: 0.00 -> 1.40s 积蓄发光 -> 1.40..1.88s 爆裂瞬闪后消散）
    if (elapsed < 1.88) {
      this.seedGroup.visible = true;
      if (elapsed < 1.4) {
        const p = THREE.MathUtils.clamp((elapsed - 0.06) / 1.34, 0, 1);
        const glow = Math.pow(p, 1.75);
        const surge = elapsed > 1.28 ? ((elapsed - 1.28) / 0.12) * 1.4 : 0;

        this.coreSprite.scale.setScalar(0.05 + glow * 2.35 + surge);
        this.coreMat.opacity = Math.min(1, 0.08 + glow * 0.92);

        this.flareSprite.scale.setScalar(0.1 + glow * 5.5 + surge * 1.8);
        this.flareMat.opacity = Math.min(1, 0.05 + glow * 0.9);
        this.flareMat.rotation = elapsed * 0.7;

        this.haloSprite.scale.setScalar(0.2 + glow * 6.6 + surge * 2.0);
        this.haloMat.opacity = glow * 0.48;
      } else {
        const fade = THREE.MathUtils.clamp(1 - (elapsed - 1.4) / 0.48, 0, 1);
        const flashBurst = elapsed < 1.54 ? 1 + Math.sin(((elapsed - 1.4) / 0.14) * Math.PI) * 0.55 : 1;
        this.coreSprite.scale.setScalar(3.75 * fade * flashBurst);
        this.coreMat.opacity = fade * fade;
        this.flareSprite.scale.setScalar(7.3 * (0.4 + 0.6 * fade));
        this.flareMat.opacity = fade * 0.85;
        this.flareMat.rotation = elapsed * 0.9;
        this.haloSprite.scale.setScalar(8.6 * (1.2 - 0.2 * fade));
        this.haloMat.opacity = fade * fade * 0.42;
      }
    } else {
      this.seedGroup.visible = false;
    }

    // C. 爆开冲击光环（1.40 -> 2.35s）
    if (elapsed >= 1.4 && elapsed <= 2.35) {
      const rp = (elapsed - 1.4) / 0.95;
      const ringScale = 0.4 + Math.pow(rp, 0.72) * 17.1;
      this.shockMesh.visible = true;
      this.shockMesh.scale.set(ringScale, ringScale, 1);
      this.shockMat.opacity = 0.88 * Math.pow(1 - rp, 1.8);
    } else {
      this.shockMesh.visible = false;
    }

    // D. 流星灯带彗核头（Act 3: 2.55 -> 4.95s 从树梢 t=0.98 一路向下环绕至树底 t=0.02）
    const ribbonP = THREE.MathUtils.clamp((elapsed - 2.55) / 2.4, 0, 1);
    const tHead = 0.98 - easeInOutQuad(ribbonP) * 0.96;

    if (elapsed >= 2.5 && elapsed <= 5.2) {
      this.cometGroup.visible = true;
      getRibbonPoint(tHead, this._tmpTarget);
      this.cometGroup.position.copy(this._tmpTarget);

      const enterFade = THREE.MathUtils.clamp((elapsed - 2.5) / 0.18, 0, 1);
      const exitFade = elapsed > 4.85 ? THREE.MathUtils.clamp(1 - (elapsed - 4.85) / 0.3, 0, 1) : 1;
      const alpha = enterFade * exitFade;
      const pulse = 1 + 0.18 * Math.sin(elapsed * 22);

      this.cometCore.scale.setScalar(2.1 * pulse);
      this.cometCoreMat.opacity = alpha * 0.95;
      this.cometFlare.scale.setScalar(3.4 * pulse);
      this.cometFlareMat.opacity = alpha * 0.9;
      this.cometFlareMat.rotation = elapsed * 2.2;
    } else {
      this.cometGroup.visible = false;
    }

    // E. 900 粒光效粒子全流程位置与明暗计算
    if (elapsed >= 0.1 && elapsed <= 5.65) {
      this.burstMesh.visible = true;
      const act4Fade = elapsed > 5.3 ? THREE.MathUtils.clamp(1 - (elapsed - 5.3) / 0.35, 0, 1) : 1;
      const trailActive = elapsed >= 2.55 && elapsed <= 5.15;

      for (let i = 0; i < this.particleCount; i += 1) {
        const p = this.particles[i];
        let px = 0;
        let py = SEED_CENTER_Y;
        let pz = 0;
        let brightness = 0;

        if (p.isCometTrail) {
          if (trailActive) {
            const trailStep = (p.trailFrac + (elapsed * 1.45) % 1) % 1;
            const tt = THREE.MathUtils.clamp(tHead + 0.01 + trailStep * 0.085, 0.01, 0.99);
            getRibbonPoint(tt, this._tmpTarget);
            const spread = 0.08 + trailStep * 0.42;
            px = this._tmpTarget.x + p.dx * spread;
            py = this._tmpTarget.y + p.dy * spread * 0.7;
            pz = this._tmpTarget.z + p.dz * spread;
            brightness = Math.pow(1 - trailStep, 1.4) * (0.7 + 0.3 * Math.sin(elapsed * 18 + p.phase));
            this._tmpCol.copy(p.role % 2 === 0 ? this.palette.gold : this.palette.whiteGold);
          }
        } else if (elapsed < 1.4) {
          // Act 1：部分微光粒螺旋向中心汇聚吸能
          if (p.isChargeMote) {
            const cp = ((elapsed * 0.85 + (p.phase / (Math.PI * 2))) % 1);
            const r = p.inwardDist * Math.pow(1 - cp, 1.4);
            const spin = cp * 2.2 + p.phase;
            px = (p.dx * Math.cos(spin) - p.dz * Math.sin(spin)) * r;
            py = SEED_CENTER_Y + p.dy * r;
            pz = (p.dx * Math.sin(spin) + p.dz * Math.cos(spin)) * r;
            brightness = Math.sin(cp * Math.PI) * 0.78 * THREE.MathUtils.clamp(elapsed / 0.6, 0, 1);
          }
          this._getRoleColor(p.role, this._tmpCol);
        } else {
          // Act 2 -> Act 3：从中心炸开 -> 旋涡飞向各自从上往下的螺旋灯带目标点
          const dt = elapsed - 1.4;
          const explodeR = p.burstDist * (1 - Math.exp(-dt * 2.9));
          const driftAngle = dt * 0.28;
          const cd = Math.cos(driftAngle);
          const sd = Math.sin(driftAngle);
          const bx = (p.dx * cd - p.dz * sd) * explodeR;
          const by = SEED_CENTER_Y + p.dy * explodeR * 0.82 + Math.sin(elapsed * 2.1 + p.phase) * 0.2;
          const bz = (p.dx * sd + p.dz * cd) * explodeR;

          const clampedTargetT = THREE.MathUtils.clamp(p.targetT, 0.03, 0.97);
          const arriveTime = 2.55 + (1.0 - clampedTargetT) * 2.35;
          const convWindow = 0.85;
          const convRaw = (elapsed - (arriveTime - convWindow)) / convWindow;

          if (convRaw <= 0) {
            px = bx;
            py = by;
            pz = bz;
            const burstPop = Math.min(1, dt * 6.5);
            const shimmer = 0.72 + 0.28 * Math.sin(elapsed * 9.0 + p.phase);
            brightness = burstPop * shimmer;
            this._getRoleColor(p.role, this._tmpCol);
          } else if (convRaw < 1) {
            const ease = easeInOutCubic(convRaw);
            getRibbonPoint(clampedTargetT, this._tmpTarget);
            const tx = this._tmpTarget.x + p.radialSpread * 0.45;
            const ty = this._tmpTarget.y + p.heightSpread * 0.45;
            const tz = this._tmpTarget.z + p.radialSpread * 0.45;

            const swirl = (1 - ease) * (2.4 + p.swirlOffset);
            const cs = Math.cos(swirl);
            const sn = Math.sin(swirl);
            const mx = THREE.MathUtils.lerp(bx, tx, ease);
            const my = THREE.MathUtils.lerp(by, ty, ease);
            const mz = THREE.MathUtils.lerp(bz, tz, ease);
            px = mx * cs - mz * sn;
            py = my;
            pz = mx * sn + mz * cs;

            brightness = 0.85 + 0.35 * ease;
            this._getRoleColor(p.role, this._tmpCol).lerp(this.palette.gold, ease * 0.85);
          } else {
            const after = elapsed - arriveTime;
            getRibbonPoint(clampedTargetT, this._tmpTarget);
            px = this._tmpTarget.x + p.radialSpread * 0.35;
            py = this._tmpTarget.y + p.heightSpread * 0.35;
            pz = this._tmpTarget.z + p.radialSpread * 0.35;

            if (after < 0.22) {
              brightness = 1.2 - (after / 0.22) * 0.25;
            } else {
              brightness = Math.max(0, 0.95 * (1 - (after - 0.22) / 0.26));
            }
            this._tmpCol.copy(this.palette.gold).lerp(this.palette.whiteGold, 0.35);
          }
        }

        brightness *= act4Fade;
        this.burstPositions[i * 3] = px;
        this.burstPositions[i * 3 + 1] = py;
        this.burstPositions[i * 3 + 2] = pz;

        this.burstColors[i * 3] = this._tmpCol.r * brightness;
        this.burstColors[i * 3 + 1] = this._tmpCol.g * brightness;
        this.burstColors[i * 3 + 2] = this._tmpCol.b * brightness;
      }

      this.burstMesh.geometry.attributes.position.needsUpdate = true;
      this.burstMesh.geometry.attributes.color.needsUpdate = true;
    } else {
      this.burstMesh.visible = false;
    }
  }
}
