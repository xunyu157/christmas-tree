/**
 * 程序化粒子贴图生成器
 * --------------------------------------------------
 * 用浏览器内置的 2D Canvas 现画柔和光斑、四芒星芒和底部雾光贴图，
 * 无需外部图片资源，加载速度极快且永远不会出现图片裂开。
 */

import * as THREE from 'three';

/**
 * 柔和圆形光斑贴图（用于碎钻粒子、雪花、烟花）
 */
export function createGlowDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.32)');
  grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.06)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 四芒星芒贴图（用于树顶核心强光、夜空闪星、树身碎钻高光）
 */
export function createStarSparkleTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  // 中心柔和光晕
  const core = ctx.createRadialGradient(half, half, 0, half, half, half * 0.65);
  core.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  core.addColorStop(0.18, 'rgba(255, 245, 252, 0.85)');
  core.addColorStop(0.45, 'rgba(255, 225, 245, 0.22)');
  core.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // 十字尖锐星芒
  const drawRay = (angle, length, thickness) => {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(angle);
    const rayGrad = ctx.createLinearGradient(-length, 0, length, 0);
    rayGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    rayGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
    rayGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.98)');
    rayGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.35)');
    rayGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, length, thickness, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawRay(0, half * 0.96, 2.6);
  drawRay(Math.PI / 2, half * 0.96, 2.6);
  drawRay(Math.PI / 4, half * 0.45, 1.4);
  drawRay(-Math.PI / 4, half * 0.45, 1.4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 底部星河雾光贴图（还原示例图树底的柔和月光水雾圆晕）
 */
export function createFloorMistTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.62)');
  grad.addColorStop(0.32, 'rgba(235, 245, 255, 0.40)');
  grad.addColorStop(0.62, 'rgba(200, 225, 255, 0.18)');
  grad.addColorStop(0.84, 'rgba(180, 210, 255, 0.05)');
  grad.addColorStop(1.0, 'rgba(180, 210, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
