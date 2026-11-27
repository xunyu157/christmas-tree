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

export class ChristmasApp {
  constructor(container, initialConfig) {
    this.container = container;
    this.config = initialConfig;
    this.isMobile = window.innerWidth < 768;

    this.scene = new THREE.Scene();

    // 在 WebGL 场景内部绘制暗夜渐变背景，确保开启 UnrealBloomPass 辉光时背景层次依然深邃通透
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 2;
    this.skyCanvas.height = 256;
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTexture;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 180);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    container.appendChild(this.renderer.domElement);

    // 交互轨道控制：支持鼠标/单指拖拽旋转 + 滚轮/双指缩放
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 36;
    this.controls.minPolarAngle = 0.58;
    this.controls.maxPolarAngle = 1.62;
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

    // 电影级梦幻辉光后处理管线（UnrealBloomPass）
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      initialConfig.effects.bloomStrength,
      0.52,
      0.16
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
    this._animate();
  }

  /**
   * 更新 WebGL 内部深空夜幕渐变背景（避免 Bloom 后处理覆盖透明通道）
   */
  _updateSkyBackground(skyTop, skyBottom) {
    const ctx = this.skyCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, this.skyCanvas.height);
    grad.addColorStop(0.0, skyTop);
    grad.addColorStop(0.58, skyTop);
    grad.addColorStop(1.0, skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.skyCanvas.width, this.skyCanvas.height);
    this.skyTexture.needsUpdate = true;
  }

  /**
   * 自动适配手机竖屏与电脑横屏构图，确保树顶祝福语与底部漩涡都不被裁切
   */
  _updateCameraFraming(width, height, resetPosition = false) {
    const aspect = width / Math.max(height, 1);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    if (resetPosition) {
      // 精准对齐示例图黄金比例：顶部留出双行祝福语空间，底部完整展现星河漩涡
      const distance = aspect < 0.72 ? 26.8 : aspect < 1.0 ? 24.2 : 22.8;
      const camY = aspect < 0.72 ? 3.9 : 3.4;
      const targetY = aspect < 0.72 ? 2.05 : 1.95;
      this.camera.position.set(0, camY, distance);
      this.controls.target.set(0, targetY, 0);
      this.controls.update();
    }
  }

  _bindEvents() {
    this._onResize = () => {
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      this._updateCameraFraming(width, height, false);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(width, height);
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(width, height);
      this.bloomPass.setSize(width, height);

      this.tree.setPixelRatio(this.pixelRatio);
      this.topper.setPixelRatio(this.pixelRatio);
      this.vortex.setPixelRatio(this.pixelRatio);
      this.atmosphere.setPixelRatio(this.pixelRatio);
    };

    this._onPointerDown = (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    this._onPointerUp = (e) => {
      if (!this.pointerDownPos) return;
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      this.pointerDownPos = null;

      // 仅在短按点击（而非拖拽旋转视角）时于夜空绽放一朵烟花
      if (Math.hypot(dx, dy) < 7 && this.config.effects.fireworks) {
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
        }
      }
    };

    window.addEventListener('resize', this._onResize);
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

    this.atmosphere.setStarsVisible(config.effects.stars);
    this.atmosphere.setSnowVisible(config.effects.snow);

    this.controls.autoRotate = config.effects.autoRotate;
    this.bloomPass.strength = config.effects.bloom ? config.effects.bloomStrength : 0;
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

    this.controls.update();
    this.tree.update(elapsed);
    this.topper.update(elapsed);
    this.vortex.update(elapsed, delta);
    this.fireworks.update(delta);
    this.atmosphere.update(elapsed, delta);

    this.renderOnce();
  }

  dispose() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this._onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
