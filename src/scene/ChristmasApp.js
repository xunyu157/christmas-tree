/**
 * 3D 圣诞树主渲染引擎总控（ChristmasApp）
 * --------------------------------------------------
 * 负责把场景、相机、触控旋转、梦幻辉光（UnrealBloomPass）以及
 * 粒子树、树顶、底部星河、烟花、星空雪花统一协调运转起来。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import {
  createGlowDotTexture,
  createStarSparkleTexture,
  createFloorMistTexture
} from './particleTexture.js';
import { TreeBuilder } from './TreeBuilder.js';
import { TopperBuilder } from './TopperBuilder.js';
import { GroundVortex } from './GroundVortex.js';
import { FireworksSystem } from './FireworksSystem.js';
import { AtmosphereSystem } from './AtmosphereSystem.js';
import { WinterVillage } from './WinterVillage.js';
import { GiftBoxes } from './GiftBoxes.js';
import { IntroEffectSystem } from './IntroEffectSystem.js';
import { MusicBoxPlayer } from '../audio/MusicBoxPlayer.js';

function evalHermite(v1, m1, v2, m2, dt, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * v1 + h10 * (m1 * dt) + h01 * v2 + h11 * (m2 * dt);
}

export class ChristmasApp {
  constructor(container, initialConfig, options = {}) {
    this.container = container;
    this.config = initialConfig;
    this.isMobile = window.innerWidth < 768;
    this.startWithIntro = options.startWithIntro !== false;

    this.introState = this.startWithIntro ? 'idle' : 'lit';
    this.introElapsed = 0;
    this.introDuration = 14.4;
    this.worldReveal = this.startWithIntro ? 0 : 1;
    this.introFlags = {
      burstChime: false,
      greetingShown: false,
      wave1: false,
      wave2: false,
      wave3: false,
      wave4: false
    };
    this.introCallbacks = { onGreetingReveal: null, onComplete: null };

    this.scene = new THREE.Scene();
    this.blackBg = new THREE.Color('#000000');
    this._tmpFogColor = new THREE.Color();

    // 静谧雪夜月光照明（开场先保持熄灭以凸显纯黑中圣诞树诞生，成树后随光波柔和亮起）
    this.hemiLight = new THREE.HemisphereLight('#9ec0e8', '#1c2842', 0.58);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight('#cfe4ff', 0.85);
    this.moonLight.position.set(-16, 22, -18);
    this.scene.add(this.moonLight);

    this.frontFillLight = new THREE.DirectionalLight('#8faad4', 0.45);
    this.frontFillLight.position.set(8, 10, 18);
    this.scene.add(this.frontFillLight);

    this.baseTreeLightIntensity = 6.0;
    this.treeLightFactor = 1.0;
    this.treeBaseLight = new THREE.PointLight('#ffe3ad', this.baseTreeLightIntensity, 10.8, 1.6);
    this.treeBaseLight.position.set(0, -2.1, 0);
    this.scene.add(this.treeBaseLight);

    this.nightFog = new THREE.Fog(initialConfig.colors.skyBottom, 42, 126);
    this.scene.fog = initialConfig.effects.winterVillage ? this.nightFog : null;

    // 在 WebGL 场景内部绘制暗夜渐变背景，确保开启 UnrealBloomPass 辉光时背景层次依然深邃通透
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 2;
    this.skyCanvas.height = 256;
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTexture;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 220);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    container.appendChild(this.renderer.domElement);

    // 交互轨道控制：支持鼠标/单指拖拽旋转 + 滚轮/双指缩放
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 36;
    this.controls.minPolarAngle = 0.66;
    this.controls.maxPolarAngle = 1.54;
    this.controls.autoRotate = initialConfig.effects.autoRotate;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.target.set(0, 0.9, 0);

    this._updateCameraFraming(width, height, true);

    // 程序化粒子贴图
    const dotTexture = createGlowDotTexture();
    const sparkleTexture = createStarSparkleTexture();
    const mistTexture = createFloorMistTexture();

    // 圣诞树整体容器（树体 + 丝带 + 树顶同步缓慢旋转）
    this.treeRig = new THREE.Group();
    this.scene.add(this.treeRig);

    this.tree = new TreeBuilder(initialConfig.colors, this.isMobile);
    this.topper = new TopperBuilder(
      initialConfig.topper,
      initialConfig.colors.topperColor,
      sparkleTexture
    );
    this.treeRig.add(this.tree.group);
    this.treeRig.add(this.topper.group);

    this.vortex = new GroundVortex(initialConfig.colors, mistTexture, this.isMobile);
    this.scene.add(this.vortex.group);

    this.fireworks = new FireworksSystem(dotTexture, initialConfig.colors.topperColor);
    this.scene.add(this.fireworks.group);

    this.atmosphere = new AtmosphereSystem(dotTexture, sparkleTexture, this.isMobile);
    this.scene.add(this.atmosphere.group);

    this.village = new WinterVillage(initialConfig.colors, dotTexture);
    this.scene.add(this.village.group);

    this.gifts = new GiftBoxes(initialConfig.colors);
    this.scene.add(this.gifts.group);

    this.introEffects = new IntroEffectSystem(
      initialConfig.colors,
      dotTexture,
      sparkleTexture,
      this.isMobile
    );
    this.scene.add(this.introEffects.group);

    this.music = new MusicBoxPlayer();
    this.onMusicStateChange = null;

    // 电影级梦幻辉光后处理管线（UnrealBloomPass）
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);

    const renderPass = new RenderPass(this.scene, this.camera);
    // 提高辉光阈值（0.82）并收紧扩散半径（0.28）：只让高光碎钻、树顶星芒与烟花泛起柔和光晕，彻底杜绝树身与夜空过曝泛白
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      initialConfig.effects.bloomStrength,
      0.28,
      0.82
    );
    const outputPass = new OutputPass();

    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(outputPass);

    // 点击夜空放烟花的射线检测器
    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = null;
    this.fireworkPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 4.5);

    this.clock = new THREE.Clock();
    this.animFrameId = null;

    this._bindEvents();
    this.applyConfig(initialConfig);
    if (this.startWithIntro) {
      this.resetIntro();
    } else {
      this.introEffects.setFinished();
    }
    this._animate();
  }

  /**
   * 更新 WebGL 内部深空夜幕渐变背景（支持从天顶向地平线自上而下倾泻点亮）
   */
  _updateSkyBackground(skyTop, skyBottom, skyProgress = 1.0) {
    const p = THREE.MathUtils.clamp(skyProgress, 0, 1);
    if (p <= 0.001) {
      this.scene.background = this.blackBg;
      return;
    }

    const ctx = this.skyCanvas.getContext('2d');
    const topCol = new THREE.Color(skyTop);
    const botCol = new THREE.Color(skyBottom);
    const grad = ctx.createLinearGradient(0, 0, 0, this.skyCanvas.height);

    if (p >= 0.999) {
      grad.addColorStop(0.0, skyTop);
      grad.addColorStop(0.36, topCol.clone().lerp(botCol, 0.24).getStyle());
      grad.addColorStop(0.74, topCol.clone().lerp(botCol, 0.70).getStyle());
      grad.addColorStop(1.0, skyBottom);
    } else {
      for (let i = 0; i <= 8; i += 1) {
        const v = i / 8;
        const baseMix =
          v < 0.36
            ? (v / 0.36) * 0.24
            : v < 0.74
              ? 0.24 + ((v - 0.36) / 0.38) * 0.46
              : 0.7 + ((v - 0.74) / 0.26) * 0.3;
        const localReveal = THREE.MathUtils.smoothstep(p, v * 0.52, v * 0.52 + 0.48);
        const stopCol = topCol.clone().lerp(botCol, baseMix).multiplyScalar(localReveal);
        grad.addColorStop(v, stopCol.getStyle());
      }
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.skyCanvas.width, this.skyCanvas.height);
    this.skyTexture.needsUpdate = true;
    this.scene.background = this.skyTexture;
  }

  /**
   * 烟花破晓自上而下“倾泻”唤醒全背景（0..1 对应天顶烟花 -> 群星月云 -> 远山雪脊 -> 松林木屋路灯 -> 雪地飘雪）
   */
  _applyWorldReveal(progress) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    this.worldReveal = p;

    if (p <= 0.001) {
      this.hemiLight.intensity = 0;
      this.moonLight.intensity = 0;
      this.frontFillLight.intensity = 0;
      this.treeLightFactor = 0;
      this.treeBaseLight.intensity = 0;
      this.atmosphere.setReveal(0, 0);
      this.village.setVisible(false);
      this.village.setReveal(0);
      this.gifts.setVisible(false);
      this.gifts.setReveal(0);
      this.scene.fog = null;
      this.scene.background = this.blackBg;
      return;
    }

    const showVillage = Boolean(this.config.effects.winterVillage);
    this.nightFog.color.set(this.config.colors.skyBottom);
    this.nightFog.near = 42;
    this.nightFog.far = 126;

    if (p >= 0.999) {
      this.hemiLight.intensity = 0.58;
      this.moonLight.intensity = 0.85;
      this.frontFillLight.intensity = 0.45;
      this.treeLightFactor = 1;
      this.treeBaseLight.intensity = this.baseTreeLightIntensity;
      this.atmosphere.setReveal(1, 1);
      this.village.setVisible(showVillage);
      this.village.setReveal(1);
      this.gifts.setVisible(true);
      this.gifts.setReveal(1);
      this._updateSkyBackground(this.config.colors.skyTop, this.config.colors.skyBottom, 1);
      this.scene.fog = showVillage ? this.nightFog : null;
      return;
    }

    const skyP = THREE.MathUtils.clamp(p / 0.38, 0, 1);
    const starP = THREE.MathUtils.clamp((p - 0.02) / 0.4, 0, 1);
    const moonP = THREE.MathUtils.clamp((p - 0.05) / 0.34, 0, 1);
    const cloudP = THREE.MathUtils.clamp((p - 0.1) / 0.38, 0, 1);
    const lightP = THREE.MathUtils.clamp((p - 0.04) / 0.34, 0, 1);
    const curtainT = THREE.MathUtils.clamp((p - 0.065) / 0.9, 0, 1);
    const curtainEase = curtainT * curtainT * (3 - 2 * curtainT);
    const cascadeY = THREE.MathUtils.lerp(25.5, -12.5, curtainEase);
    const edgeGlow = Math.sin(curtainT * Math.PI);
    const cottageP = THREE.MathUtils.clamp((p - 0.42) / 0.34, 0, 1);
    const lampP = THREE.MathUtils.clamp((p - 0.5) / 0.32, 0, 1);
    const groundP = THREE.MathUtils.clamp((p - 0.58) / 0.38, 0, 1);

    const lightEase = THREE.MathUtils.smoothstep(lightP, 0, 1);
    this.hemiLight.intensity = 0.58 * lightEase;
    this.moonLight.intensity = 0.85 * lightEase;
    this.frontFillLight.intensity = 0.45 * lightEase;
    this.treeLightFactor = lightEase;
    this.treeBaseLight.intensity = this.baseTreeLightIntensity * lightEase;

    this._updateSkyBackground(this.config.colors.skyTop, this.config.colors.skyBottom, skyP);
    this.scene.fog = showVillage ? this.nightFog : null;
    this.atmosphere.setReveal(starP, groundP);

    this.village.setVisible(showVillage);
    this.village.setReveal({
      active: true,
      cascadeY,
      edgeGlow,
      moonP,
      cloudP,
      cottageP,
      lampP,
      groundP
    });

    this.gifts.setVisible(true);
    this.gifts.setReveal({
      active: true,
      cascadeY,
      edgeGlow,
      groundP
    });
  }

  /**
   * 计算适配不同屏幕比例的标准主视觉相机站位
   */
  _getHeroFraming() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(height, 1);
    const dist = aspect < 0.72 ? 27.2 : aspect < 1.0 ? 24.6 : 23.4;
    const camY = aspect < 0.72 ? 4.0 : 3.6;
    const targetY = 2.15;
    return { aspect, dist, camY, targetY };
  }

  /**
   * 自动适配手机竖屏与电脑横屏构图，确保树顶祝福语与底部漩涡都不被裁切
   */
  _updateCameraFraming(width, height, resetPosition = false) {
    const aspect = width / Math.max(height, 1);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    if (resetPosition) {
      const { dist, camY, targetY } = this._getHeroFraming();
      this.camera.position.set(0, camY, dist);
      this.controls.target.set(0, targetY, 0);
      this.controls.update();
    }
  }

  /**
   * 14.4 秒烟花破晓与多角度运镜编排（0.3s 独亮停顿 -> 第一波烟花炸开 -> 仰望倾泻光瀑缓缓收归全景）
   */
  _applyIntroCamera(elapsed) {
    const hero = this._getHeroFraming();
    const distScale = hero.dist / 23.4;

    const kf = [
      { t: 0.0, az: 0.0, dist: 11.8 * distScale, camY: 2.2, targetY: 2.2 },
      { t: 1.95, az: 0.17, dist: 7.6 * distScale, camY: 2.35, targetY: 2.2 },
      { t: 3.4, az: 0.9, dist: 26.2 * distScale, camY: 9.4, targetY: 2.1 },
      { t: 4.15, az: 1.08, dist: 24.8 * distScale, camY: 8.8, targetY: 2.2 },
      { t: 5.85, az: -0.18, dist: 14.8 * distScale, camY: 6.2, targetY: 3.1 },
      { t: 7.05, az: -0.44, dist: 15.6 * distScale, camY: 4.5, targetY: 2.4 },
      { t: 7.65, az: -0.68, dist: 16.8 * distScale, camY: 3.2, targetY: 2.2 },
      { t: 9.35, az: -1.16, dist: 18.8 * distScale, camY: 1.45, targetY: 1.85 },
      { t: 10.35, az: -0.22, dist: 22.0 * distScale, camY: 2.9, targetY: 2.15 },
      { t: 10.65, az: -0.06, dist: 23.0 * distScale, camY: 3.05, targetY: 2.55 },
      { t: 11.85, az: 0.05, dist: 24.4 * distScale, camY: 4.45, targetY: 2.85 },
      { t: 13.45, az: 0.0, dist: hero.dist, camY: hero.camY, targetY: hero.targetY },
      { t: 14.4, az: 0.0, dist: hero.dist, camY: hero.camY, targetY: hero.targetY }
    ];

    let az = 0;
    let dist = hero.dist;
    let camY = hero.camY;
    let targetY = hero.targetY;

    const t = THREE.MathUtils.clamp(elapsed, 0, 14.4);
    if (t < 13.45) {
      let seg = 0;
      for (let i = 0; i < kf.length - 2; i += 1) {
        if (t >= kf[i].t && t <= kf[i + 1].t) {
          seg = i;
          break;
        }
      }

      const k1 = kf[seg];
      const k2 = kf[seg + 1];
      const dt = k2.t - k1.t;
      const u = THREE.MathUtils.clamp((t - k1.t) / dt, 0, 1);

      const tangentAt = (idx, prop) => {
        if (idx <= 0 || idx >= 11) return 0;
        const prev = kf[idx - 1];
        const curr = kf[idx];
        const next = kf[idx + 1];
        const s1 = (curr[prop] - prev[prop]) / (curr.t - prev.t);
        const s2 = (next[prop] - curr[prop]) / (next.t - curr.t);
        return 0.5 * (s1 + s2);
      };

      az = evalHermite(k1.az, tangentAt(seg, 'az'), k2.az, tangentAt(seg + 1, 'az'), dt, u);
      dist = evalHermite(k1.dist, tangentAt(seg, 'dist'), k2.dist, tangentAt(seg + 1, 'dist'), dt, u);
      camY = evalHermite(k1.camY, tangentAt(seg, 'camY'), k2.camY, tangentAt(seg + 1, 'camY'), dt, u);
      targetY = evalHermite(k1.targetY, tangentAt(seg, 'targetY'), k2.targetY, tangentAt(seg + 1, 'targetY'), dt, u);
    }

    this.camera.position.set(Math.sin(az) * dist, camY, Math.cos(az) * dist);
    this.controls.target.set(0, targetY, 0);
    this.camera.lookAt(0, targetY, 0);
  }

  _bindEvents() {
    this._onResize = () => {
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      this._updateCameraFraming(width, height, false);
      if (this.introState === 'idle') {
        this._applyIntroCamera(0);
        this.introEffects.syncCamera(this.camera);
      }
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(width, height);
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(width, height);
      this.bloomPass.setSize(width, height);

      this.tree.setPixelRatio(this.pixelRatio);
      this.topper.setPixelRatio(this.pixelRatio);
      this.vortex.setPixelRatio(this.pixelRatio);
      this.atmosphere.setPixelRatio(this.pixelRatio);
      this.gifts.setPixelRatio(this.pixelRatio);
      this.introEffects.setPixelRatio(this.pixelRatio);
    };

    this._onPointerDown = (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    this._onPointerUp = (e) => {
      if (!this.pointerDownPos) return;
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      this.pointerDownPos = null;

      // 仅在短按点击（而非拖拽旋转视角）且已点亮圣诞树时于夜空绽放一朵烟花
      if (
        Math.hypot(dx, dy) < 7 &&
        this.config.effects.fireworks &&
        this.introState === 'lit'
      ) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        const hit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.fireworkPlane, hit)) {
          hit.x = THREE.MathUtils.clamp(hit.x, -9.5, 9.5);
          hit.y = THREE.MathUtils.clamp(hit.y, -2.5, 8.0);
          this.fireworks.launchAt(hit.x, hit.y, hit.z);
          if (this.config.effects.music && this.music.isPlaying()) {
            this.music.playFireworkChime();
          }
        }
      }
    };

    this._onVisibilityChange = () => {
      this.music.handleVisibilityChange(document.hidden);
    };

    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  /**
   * 实时应用用户定制的配置（颜色、树顶、特效开关、辉光强度）
   */
  applyConfig(config) {
    this.config = config;

    // 同步深空渐变背景（CSS + WebGL 内部背景双同步）
    document.documentElement.style.setProperty('--sky-top', config.colors.skyTop);
    document.documentElement.style.setProperty('--sky-bottom', config.colors.skyBottom);
    this._updateSkyBackground(config.colors.skyTop, config.colors.skyBottom);

    this.tree.setColors(config.colors);
    this.tree.setRibbonVisible(config.effects.ribbon);

    this.topper.setType(config.topper);
    this.topper.setColor(config.colors.topperColor);

    this.vortex.setColors(config.colors);
    this.vortex.setVisible(config.effects.vortex);

    this.fireworks.setEnabled(config.effects.fireworks);
    this.fireworks.setThemeTint(config.colors.topperColor);
    this.fireworks.setAutoPaused(this.introState !== 'lit');

    this.atmosphere.setStarsVisible(config.effects.stars);
    this.atmosphere.setSnowVisible(config.effects.snow);

    this.village.setColors(config.colors);
    this.gifts.setColors(config.colors);
    this.treeBaseLight.color
      .set('#ffe3ad')
      .lerp(new THREE.Color(config.colors.ribbonColor), 0.30)
      .lerp(new THREE.Color(config.colors.treePrimary), 0.10);
    this.introEffects.setColors(config.colors);
    this._applyWorldReveal(this.introState === 'lit' ? 1 : this.worldReveal);

    this.controls.autoRotate = config.effects.autoRotate;
    this.bloomPass.strength = config.effects.bloom ? config.effects.bloomStrength : 0;

    if (!config.effects.music && this.music.isPlaying()) {
      this.music.stop();
      this.onMusicStateChange?.(false);
    } else if (this.music.isPlaying()) {
      this.music.setTrack(config.effects.musicTrack);
    }
  }

  /**
   * 开关八音盒圣诞音乐（需在点击事件内触发以确保手机浏览器自动解锁音频）
   */
  setMusicEnabled(enabled) {
    this.config.effects.music = Boolean(enabled);
    if (this.config.effects.music) {
      this.music.unlock();
      this.music.start(this.config.effects.musicTrack, 0.05);
    } else {
      this.music.stop();
    }
    this.onMusicStateChange?.(this.music.isPlaying());
  }

  setMusicTrack(trackId) {
    this.config.effects.musicTrack = trackId;
    if (this.music.isPlaying()) {
      this.music.setTrack(trackId);
    } else if (this.introState === 'lit') {
      this.setMusicEnabled(true);
    }
  }

  isMusicPlaying() {
    return this.music.isPlaying();
  }

  /**
   * 触发开场“点亮圣诞树”14.4 秒烟花破晓 · 光瀑倾泻交响动画
   */
  ignite(callbacks = {}) {
    if (this.introState !== 'idle') return;
    this.introState = 'igniting';
    this.introElapsed = 0;
    this.introFlags = {
      burstChime: false,
      greetingShown: false,
      wave1: false,
      wave2: false,
      wave3: false,
      wave4: false
    };
    this.introCallbacks = callbacks;
    this.controls.enabled = false;
    this.fireworks.setAutoPaused(true);

    if (this.config.effects.music) {
      this.music.unlock();
      this.music.playIgniteChime();
      this.music.start(this.config.effects.musicTrack, 2.35);
      this.onMusicStateChange?.(this.music.isPlaying());
    }

    this._applyIntroProgress(0);
  }

  /**
   * 重置为全黑等待点亮状态（背景熄灭，仅保留待点燃星光）
   */
  resetIntro() {
    this.introState = 'idle';
    this.introElapsed = 0;
    this.introFlags = {
      burstChime: false,
      greetingShown: false,
      wave1: false,
      wave2: false,
      wave3: false,
      wave4: false
    };
    this.controls.enabled = false;
    this.controls.autoRotateSpeed = 0.55;
    this.music.stop();
    this.onMusicStateChange?.(false);
    this.fireworks.setAutoPaused(true);
    this.fireworks.clearAll();

    this._applyIntroCamera(0);
    this._applyWorldReveal(0);
    this.tree.setIntroProgress(0, 0, 0, 0);
    this.topper.setReveal(0);
    this.vortex.setReveal(0);
    this.introEffects.setIdle(this.camera);
  }

  _applyIntroProgress(elapsed) {
    this._applyIntroCamera(elapsed);
    this.introEffects.updateIntro(elapsed, this.camera);

    const burst = THREE.MathUtils.clamp((elapsed - 2.0) / 1.4, 0, 1);
    const hazeAlpha = THREE.MathUtils.clamp((elapsed - 2.0) / 0.48, 0, 1);
    const rawRib = THREE.MathUtils.clamp((elapsed - 4.15) / 2.9, 0, 1);
    const ribbonGather = rawRib < 0.5 ? 2 * rawRib * rawRib : 1 - Math.pow(-2 * rawRib + 2, 2) / 2;
    const treeGather = THREE.MathUtils.clamp((elapsed - 7.65) / 2.7, 0, 1);
    this.tree.setIntroProgress(burst, hazeAlpha, ribbonGather, treeGather);

    const topperP = THREE.MathUtils.clamp((elapsed - 4.15) / 0.8, 0, 1);
    this.topper.setReveal(topperP);

    const vortexP = THREE.MathUtils.clamp((elapsed - 9.6) / 0.95, 0, 1);
    this.vortex.setReveal(vortexP);

    // 10.35 -> 10.65s 独自闪耀停顿 0.3s 后，10.65s 第一波烟花先在黑空中炸开，10.68 -> 14.05s 光瀑倾泻照亮世界
    if (elapsed >= 2.0 && !this.introFlags.burstChime) {
      this.introFlags.burstChime = true;
      if (this.config.effects.music && this.music.isPlaying()) {
        this.music.playFireworkChime();
      }
    }

    if (elapsed >= 10.65 && !this.introFlags.wave1) {
      this.introFlags.wave1 = true;
      this.fireworks.launchFinaleWave(0);
      if (this.config.effects.fireworks && this.config.effects.music && this.music.isPlaying()) {
        this.music.playFireworkChime();
      }
    }

    const worldP = THREE.MathUtils.clamp((elapsed - 10.68) / 3.37, 0, 1);
    this._applyWorldReveal(worldP);

    if (elapsed >= 11.85 && !this.introFlags.wave2) {
      this.introFlags.wave2 = true;
      this.fireworks.launchFinaleWave(1);
      if (this.config.effects.fireworks && this.config.effects.music && this.music.isPlaying()) {
        this.music.playFireworkChime();
      }
    }

    if (elapsed >= 12.45 && !this.introFlags.greetingShown) {
      this.introFlags.greetingShown = true;
      this.introCallbacks.onGreetingReveal?.();
    }

    if (elapsed >= 12.95 && !this.introFlags.wave3) {
      this.introFlags.wave3 = true;
      this.fireworks.launchFinaleWave(2);
      if (this.config.effects.fireworks && this.config.effects.music && this.music.isPlaying()) {
        this.music.playFireworkChime();
      }
    }

    if (elapsed >= 13.85 && !this.introFlags.wave4) {
      this.introFlags.wave4 = true;
      this.fireworks.launchFinaleWave(3);
    }

    if (elapsed >= this.introDuration && this.introState === 'igniting') {
      this.introState = 'lit';
      this._applyWorldReveal(1);
      this.tree.setIntroProgress(1, 1, 1, 1);
      this.topper.setReveal(1);
      this.vortex.setReveal(1);
      this.introEffects.setFinished();

      const { dist, camY, targetY } = this._getHeroFraming();
      this.camera.position.set(0, camY, dist);
      this.controls.target.set(0, targetY, 0);
      this.controls.enabled = true;
      this.controls.autoRotateSpeed = 0.55;
      this.controls.update();

      this.fireworks.setAutoPaused(false);
      this.introCallbacks.onComplete?.();
    }
  }

  /**
   * 立即渲染最新一帧（供导出高清贺卡图前调用）
   */
  renderOnce() {
    if (this.config.effects.bloom) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getCanvas() {
    return this.renderer.domElement;
  }

  _animate() {
    this.animFrameId = requestAnimationFrame(() => this._animate());

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.introState === 'igniting') {
      this.introElapsed += delta;
      this._applyIntroProgress(this.introElapsed);
    }

    const rawBeat = this.music.update(delta);
    const beat = this.config.effects.rhythmLights ? rawBeat : 0;

    if (this.introState === 'lit') {
      this.controls.update();
    } else if (this.introState === 'idle') {
      this.introEffects.syncCamera(this.camera);
    }
    this.tree.setBeat(beat);
    this.tree.update(elapsed);
    this.topper.update(elapsed, this.camera, beat);
    this.vortex.setBeat(beat);
    this.vortex.update(elapsed, delta);
    this.fireworks.update(delta);
    this.atmosphere.update(elapsed, delta);
    this.village.update(elapsed, delta);
    this.gifts.setBeat(beat);
    this.gifts.update(elapsed);
    if (this.worldReveal > 0.001) {
      this.treeBaseLight.intensity =
        this.baseTreeLightIntensity * this.treeLightFactor * (1 + beat * 0.16);
    }

    this.renderOnce();
  }

  dispose() {
    this.music.stop();
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
