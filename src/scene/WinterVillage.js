/**
 * 静谧冬日雪夜童话山谷 3D 背景系统（WinterVillage）
 * --------------------------------------------------
 * 围绕中央碎钻粒子圣诞树打造 360° 无死角的立体雪夜山谷（平滑 3D 非像素风）：
 * 1. 完整 360° 闭合积雪木栅栏（44 根覆雪木桩 + 双层横栏 + 顶部积雪盖条）
 * 2. 13 座彼此错落分离的崎岖 3D 阿尔卑斯山体（山间留出开阔星空山口，多峰岩脊与坡度感知雪线）
 * 3. ~180 棵三圈景深覆雪 3D 松林（栅栏外侧、木屋林间、山麓坡地全周覆盖，上下稀疏自然碎雪）
 * 4. 10 座环绕雪谷的暖窗积雪木屋（柔和呼吸烛光窗 + 袅袅炊烟）
 * 5. 6 盏对称雪顶暖光复古路灯（配红色缎带 + 温暖地面光斑）+ 右侧可爱 3D 小雪人
 * 6. 星空银白满月 + 360° 飘移墨蓝黑云点缀
 */

import * as THREE from 'three';

const BASE_SNOW_Y = -4.56;

/**
 * 360° 地形高度：半径 14.6 以内庭院绝对平坦，外围向四周山谷缓缓抬升成温柔雪丘
 */
function getTerrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= 14.6) return BASE_SNOW_Y;

  const t = THREE.MathUtils.smoothstep(r, 14.6, 36.0);
  const hill =
    (Math.sin(x * 0.075 + 0.4) * Math.cos(z * 0.075 - 0.5) + 1.0) * 1.1 +
    THREE.MathUtils.smoothstep(r, 15.0, 52.0) * 2.8;

  return BASE_SNOW_Y + hill * t;
}

/**
 * 确定性伪随机数（确保每次刷新森林与山峰布局始终均匀美观）
 */
function createSeededRandom(seed = 20261225) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * 确定性 2D 整数晶格哈希 [0, 1)
 */
function hash2(ix, iz, seed) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * 五次平滑插值 2D 值噪波
 */
function valueNoise2D(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * 归一化多倍频分形布朗运动（fBm）
 */
function fbm2D(x, z, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let ampSum = 0;
  let freq = 1.0;

  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + o * 13.7);
    ampSum += amp;
    freq *= 2.04;
    amp *= 0.5;
  }

  return sum / ampSum;
}

/**
 * 阿尔卑斯脊状多分形噪波（雕刻陡峭山脊、锯齿孤峰与崎岖沟壑）
 */
function ridgedFbm2D(x, z, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let ampSum = 0;
  let freq = 1.0;
  let weight = 1.0;

  for (let o = 0; o < octaves; o += 1) {
    let signal = 1.0 - Math.abs(valueNoise2D(x * freq, z * freq, seed + o * 17.3) * 2.0 - 1.0);
    signal = signal * signal * weight;
    weight = THREE.MathUtils.clamp(signal * 1.85, 0.15, 1.0);
    sum += signal * amp;
    ampSum += amp;
    freq *= 2.12;
    amp *= 0.48;
  }

  return sum / ampSum;
}

/**
 * 雕塑彼此分离的崎岖多峰 3D 阿尔卑斯山体几何体（拒绝锥子形状，也绝不连成一整圈高墙）
 */
function createRuggedMassifGeometry({
  cx,
  cz,
  rotY,
  width,
  depth,
  height,
  seed,
  snowLineBase
}) {
  const geo = new THREE.PlaneGeometry(width, depth, 24, 18);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const vertexCount = pos.count;
  const elevations = new Float32Array(vertexCount);

  const rng = createSeededRandom(Math.floor(seed * 997) + 17);
  const p1Dir = rng() < 0.5 ? -1 : 1;
  const peaks = [
    {
      px: p1Dir * (0.08 + rng() * 0.22),
      pz: (rng() - 0.5) * 0.28,
      sx: 0.42 + rng() * 0.1,
      sz: 0.44 + rng() * 0.08,
      weight: 1.0
    },
    {
      px: -p1Dir * (0.24 + rng() * 0.2),
      pz: (rng() - 0.5) * 0.34,
      sx: 0.34 + rng() * 0.11,
      sz: 0.36 + rng() * 0.09,
      weight: 0.62 + rng() * 0.2
    }
  ];
  if (rng() > 0.28) {
    peaks.push({
      px: (rng() - 0.5) * 0.7,
      pz: (rng() < 0.5 ? -1 : 1) * (0.12 + rng() * 0.16),
      sx: 0.28 + rng() * 0.1,
      sz: 0.3 + rng() * 0.08,
      weight: 0.42 + rng() * 0.18
    });
  }

  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  for (let i = 0; i < vertexCount; i += 1) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const nx = lx / halfW;
    const nz = lz / halfD;

    const wx = nx + (fbm2D(nx * 2.2, nz * 2.2, seed + 11, 3) - 0.5) * 0.34;
    const wz = nz + (fbm2D(nx * 2.2, nz * 2.2, seed + 29, 3) - 0.5) * 0.34;

    const dist = Math.hypot(wx, wz);
    const footprint = 1.0 - THREE.MathUtils.smoothstep(dist, 0.24, 0.96);

    let maxLobe = 0;
    let secondLobe = 0;
    for (let k = 0; k < peaks.length; k += 1) {
      const pk = peaks[k];
      const dx = (wx - pk.px) / pk.sx;
      const dz = (wz - pk.pz) / pk.sz;
      const val = pk.weight * Math.exp(-(dx * dx + dz * dz));
      if (val > maxLobe) {
        secondLobe = maxLobe;
        maxLobe = val;
      } else if (val > secondLobe) {
        secondLobe = val;
      }
    }
    const lobeSum = Math.min(1.15, maxLobe + 0.22 * secondLobe);

    const warpScale = footprint * lobeSum;
    const cragDx = (fbm2D(nx * 3.1, nz * 3.1, seed + 41, 3) - 0.5) * 2.4 * warpScale;
    const cragDz = (fbm2D(nx * 3.1, nz * 3.1, seed + 53, 3) - 0.5) * 2.4 * warpScale;

    const sx = lx + cragDx;
    const sz = lz + cragDz;
    const worldX = cx + sx * cosR + sz * sinR;
    const worldZ = cz - sx * sinR + sz * cosR;

    const ridgeMain = ridgedFbm2D(worldX * 0.085, worldZ * 0.085, seed + 61, 4);
    const cragDetail = ridgedFbm2D(worldX * 0.21, worldZ * 0.21, seed + 89, 3);
    const elevation = height * footprint * lobeSum * (0.46 + 0.5 * ridgeMain + 0.24 * cragDetail);

    const baseY = getTerrainHeight(worldX, worldZ) - 1.15;
    pos.setXYZ(i, worldX, baseY + elevation, worldZ);
    elevations[i] = elevation;
  }

  geo.computeVertexNormals();

  // 先算完真实法线，再按“海拔 + 坡度法线 ny”计算陡崖深岩与缓坡雪檐色彩
  const normAttr = geo.attributes.normal;
  const colors = new Float32Array(vertexCount * 3);

  const rockBase = new THREE.Color('#111a30');
  const rockMid = new THREE.Color('#24355a');
  const rockHigh = new THREE.Color('#384e7a');
  const snowShadow = new THREE.Color('#82a0ce');
  const snowBright = new THREE.Color('#cadff8');
  const tmpRock = new THREE.Color();
  const tmpSnow = new THREE.Color();

  for (let idx = 0; idx < vertexCount; idx += 1) {
    const x = pos.getX(idx);
    const y = pos.getY(idx);
    const z = pos.getZ(idx);
    const ny = normAttr.getY(idx);

    const normElev = THREE.MathUtils.clamp(elevations[idx] / (height * 0.78), 0, 1);
    const strata = valueNoise2D(x * 0.18, y * 0.42, seed + 131);
    const drift = fbm2D(x * 0.13, z * 0.13, seed + 163, 3);

    if (normElev < 0.45) {
      tmpRock.copy(rockBase).lerp(rockMid, normElev / 0.45);
    } else {
      tmpRock.copy(rockMid).lerp(rockHigh, (normElev - 0.45) / 0.55);
    }
    tmpRock.lerp(rockMid, (strata - 0.5) * 0.25);

    const slopeSnow = THREE.MathUtils.smoothstep(ny, 0.45, 0.78);
    const altSnow = THREE.MathUtils.smoothstep(
      normElev,
      snowLineBase - 0.16 + (drift - 0.5) * 0.22,
      snowLineBase + 0.26
    );
    const ridgeSnow =
      THREE.MathUtils.smoothstep(normElev, 0.65, 0.94) *
      THREE.MathUtils.smoothstep(ny, 0.3, 0.62);
    const footSnow =
      (1.0 - THREE.MathUtils.smoothstep(normElev, 0.0, 0.16)) *
      THREE.MathUtils.smoothstep(ny, 0.55, 0.85) *
      0.62;

    const snowMask = THREE.MathUtils.clamp(
      Math.max(slopeSnow * (0.24 + 0.8 * altSnow), ridgeSnow * 0.88, footSnow),
      0,
      1
    );

    tmpSnow.copy(snowShadow).lerp(snowBright, THREE.MathUtils.clamp(normElev * 0.85 + 0.15, 0, 1));
    tmpRock.lerp(tmpSnow, snowMask);

    colors[idx * 3] = tmpRock.r;
    colors[idx * 3 + 1] = tmpRock.g;
    colors[idx * 3 + 2] = tmpRock.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * 程序化绘制柔美奶白色满月与银蓝大气月晕
 */
function createFullMoonTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const halo = ctx.createRadialGradient(cx, cy, 24, cx, cy, size * 0.48);
  halo.addColorStop(0.0, 'rgba(255, 250, 232, 0.48)');
  halo.addColorStop(0.28, 'rgba(215, 228, 255, 0.18)');
  halo.addColorStop(0.65, 'rgba(152, 180, 235, 0.04)');
  halo.addColorStop(1.0, 'rgba(130, 160, 220, 0.0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.shadowColor = 'rgba(240, 246, 255, 0.85)';
  ctx.shadowBlur = 16;
  const moonGrad = ctx.createRadialGradient(cx - 10, cy - 10, 6, cx, cy, 40);
  moonGrad.addColorStop(0.0, '#fffdf5');
  moonGrad.addColorStop(0.68, '#f7f3e3');
  moonGrad.addColorStop(1.0, '#dce5f7');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 程序化绘制写实夜空墨蓝黑云贴图（柔和遮挡星海，边缘带有极淡月色银边）
 */
function createDarkNightCloudTexture(variant = 0) {
  const w = 512;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = createSeededRandom(variant === 0 ? 441122 : 883366);

  const puffs = [];
  const count = variant === 0 ? 11 : 9;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const cx = 74 + t * 364 + (rng() - 0.5) * 32;
    const envelope = Math.sin(Math.PI * (0.08 + t * 0.84));
    const cy = h * 0.54 + (rng() - 0.5) * 28 - envelope * 10;
    const rx = (52 + rng() * 68) * (0.65 + 0.5 * envelope);
    const ry = (18 + rng() * 24) * (0.65 + 0.5 * envelope);
    puffs.push([cx, cy, rx, ry, 0.34 + rng() * 0.32]);
  }

  // 先绘淡月色上缘微光
  puffs.forEach(([cx, cy, rx, ry, alpha]) => {
    ctx.save();
    ctx.translate(cx, cy - ry * 0.28);
    ctx.scale(1, ry / rx);
    const rimGrad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx * 1.04);
    rimGrad.addColorStop(0.0, `rgba(118, 152, 212, ${alpha * 0.34})`);
    rimGrad.addColorStop(0.55, `rgba(88, 120, 182, ${alpha * 0.16})`);
    rimGrad.addColorStop(1.0, 'rgba(60, 86, 140, 0.0)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 再叠加深墨炭靛蓝黑云主体（明显压暗身后夜空与星点）
  puffs.forEach(([cx, cy, rx, ry, alpha]) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const darkGrad = ctx.createRadialGradient(0, 0, rx * 0.06, 0, 0, rx);
    darkGrad.addColorStop(0.0, `rgba(5, 9, 20, ${Math.min(0.92, alpha * 1.55)})`);
    darkGrad.addColorStop(0.54, `rgba(10, 17, 34, ${alpha * 0.92})`);
    darkGrad.addColorStop(1.0, 'rgba(16, 26, 48, 0.0)');
    ctx.fillStyle = darkGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 暖黄路灯灯晕与雪地光斑贴图
 */
function createWarmGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 232, 158, 0.56)');
  grad.addColorStop(0.35, 'rgba(255, 206, 114, 0.24)');
  grad.addColorStop(0.7, 'rgba(242, 178, 92, 0.06)');
  grad.addColorStop(1.0, 'rgba(240, 170, 84, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 程序化生成无缝松针 + 稀疏散落积雪贴图（上下自然分布、拒绝“戴白帽子”块状白雪）
 */
function createSnowyPineTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = createSeededRandom(778899);

  // 1. 深邃墨绿松枝底色渐变
  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0.0, '#132930');
  bg.addColorStop(0.55, '#1f3f48');
  bg.addColorStop(1.0, '#173139');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // 2. 密织松针纹理笔触（无缝左右平铺）
  const needleColors = ['#10242a', '#1c3c44', '#274e56'];
  for (let i = 0; i < 1600; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 6 + rng() * 11;
    const angle = (rng() - 0.5) * 0.55;
    ctx.strokeStyle = needleColors[i % needleColors.length];
    ctx.lineWidth = 1.0 + rng() * 1.2;
    ctx.globalAlpha = 0.55 + rng() * 0.35;

    [-size, 0, size].forEach((offsetX) => {
      ctx.beginPath();
      ctx.moveTo(x + offsetX, y);
      ctx.lineTo(x + offsetX + Math.sin(angle) * len, y + Math.cos(angle) * len);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;

  // 3. 稀稀疏疏、羽化自然的枝梢碎雪斑（从顶部到底部均有零星分布，透出深绿松枝）
  const drawSnowDab = (x, y, rx, ry, alpha) => {
    [-size, 0, size].forEach((offsetX) => {
      ctx.save();
      ctx.translate(x + offsetX, y);
      ctx.rotate((rng() - 0.5) * 0.45);
      ctx.scale(1, ry / rx);
      const grad = ctx.createRadialGradient(0, 0, 0.5, 0, 0, rx);
      grad.addColorStop(0.0, `rgba(222, 236, 252, ${alpha})`);
      grad.addColorStop(0.55, `rgba(196, 218, 244, ${alpha * 0.55})`);
      grad.addColorStop(1.0, 'rgba(175, 200, 232, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  // 全高度随机散落小雪簇（上下均匀覆盖，树梢略轻盈、下垂枝尖略明显，绝无整圈实心白带）
  for (let i = 0; i < 230; i += 1) {
    const y = 18 + rng() * (size - 32);
    const x = rng() * size;
    const isLowerTip = y > 240;
    const rx = (isLowerTip ? 5.5 : 4.0) + rng() * (isLowerTip ? 12.5 : 8.5);
    const ry = 2.5 + rng() * 6.0;
    const alpha = 0.62 + rng() * 0.3;
    drawSnowDab(x, y, rx, ry, alpha);

    // 在雪簇周围点缀 1~2 粒微细碎雪点，增强疏落飘雪质感
    if (rng() < 0.7) {
      drawSnowDab(
        (x + (rng() - 0.5) * 20 + size) % size,
        THREE.MathUtils.clamp(y + (rng() - 0.5) * 14, 10, size - 10),
        2.2 + rng() * 3.5,
        1.8 + rng() * 2.5,
        0.55 + rng() * 0.3
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 雕塑带有自然花瓣垂坠枝梢的松树冠层几何体
 */
function createPineTierGeometry(radius, height, lobes = 7) {
  const geo = new THREE.ConeGeometry(radius, height, 20, 5, false);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.015) continue;

    const v = THREE.MathUtils.clamp((height * 0.5 - y) / height, 0, 1);
    const theta = Math.atan2(z, x);
    const lobe = Math.cos(theta * lobes);
    const subLobe = Math.sin(theta * (lobes + 3) + 1.1) * 0.35;

    const rScale = 1.0 + (0.14 * lobe + 0.045 * subLobe) * Math.pow(v, 1.2);
    const droop = 0.13 * (0.5 + 0.5 * lobe) * Math.pow(v, 1.5);
    pos.setXYZ(i, x * rScale, y - droop, z * rScale);
  }

  geo.computeVertexNormals();
  return geo;
}

export class WinterVillage {
  constructor(colors, dotTexture) {
    this.group = new THREE.Group();
    this.rng = createSeededRandom(20261225);
    this.windowEntries = [];
    this.chimneyTips = [];
    this.smokeItems = [];
    this.cottageFootprints = [];
    this.mountainFootprints = [];
    this.cloudSprites = [];

    this._buildSnowGround(dotTexture);
    this._buildMountainRanges();
    this._buildCourtyardFence();
    this._buildDistantCottages();
    this._buildPineForest();
    this._buildChimneySmoke(dotTexture);
    this._buildStreetlamps();
    this._buildSnowman();
    this._buildMoonAndClouds();

    this.setColors(colors);
  }

  _buildSnowGround(dotTexture) {
    const geo = new THREE.PlaneGeometry(196, 196, 84, 84);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getTerrainHeight(x, z));
    }
    geo.computeVertexNormals();

    this.snowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#97a8cc'),
      emissive: new THREE.Color('#131b30'),
      emissiveIntensity: 0.36,
      roughness: 0.92,
      metalness: 0.04
    });

    this.snowGround = new THREE.Mesh(geo, this.snowMat);
    this.group.add(this.snowGround);

    // 柔美星光雪地晶粒反光
    const glintCount = 900;
    const glintPos = new Float32Array(glintCount * 3);
    for (let i = 0; i < glintCount; i += 1) {
      const r = 7.5 + this.rng() * 34.0;
      const a = this.rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      glintPos[i * 3] = x;
      glintPos[i * 3 + 1] = getTerrainHeight(x, z) + 0.045;
      glintPos[i * 3 + 2] = z;
    }

    const glintGeo = new THREE.BufferGeometry();
    glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
    this.glintMat = new THREE.PointsMaterial({
      size: 0.13,
      map: dotTexture,
      color: new THREE.Color('#dce8ff'),
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.group.add(new THREE.Points(glintGeo, this.glintMat));
  }

  _buildMountainRanges() {
    this.mountainGroup = new THREE.Group();
    this.group.add(this.mountainGroup);

    const mountainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color('#0c162b'),
      emissiveIntensity: 0.24,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true
    });

    // 13 座彼此错落分离、山脊崎岖的独立 3D 山体（山间留出开阔星空山口与明月走廊）
    const massifSpecs = [
      { angle: -2.14, dist: 56, w: 23, d: 15, h: 18.5, seed: 11.3, snowLine: 0.38 },
      { angle: -1.90, dist: 44, w: 14, d: 10, h: 9.8, seed: 19.7, snowLine: 0.46 },
      { angle: -1.24, dist: 58, w: 24, d: 16, h: 20.5, seed: 27.1, snowLine: 0.36 },
      { angle: -0.92, dist: 45, w: 14, d: 10, h: 10.2, seed: 35.4, snowLine: 0.45 },
      { angle: -0.44, dist: 55, w: 22, d: 14, h: 17.5, seed: 43.8, snowLine: 0.40 },
      { angle: 0.16, dist: 59, w: 25, d: 16, h: 21.0, seed: 52.2, snowLine: 0.36 },
      { angle: 0.56, dist: 44, w: 15, d: 11, h: 10.5, seed: 61.5, snowLine: 0.46 },
      { angle: 1.08, dist: 56, w: 23, d: 15, h: 18.0, seed: 70.9, snowLine: 0.39 },
      { angle: 1.72, dist: 58, w: 24, d: 16, h: 19.8, seed: 79.4, snowLine: 0.37 },
      { angle: 2.12, dist: 44, w: 14, d: 10, h: 9.6, seed: 88.1, snowLine: 0.46 },
      { angle: 2.58, dist: 56, w: 22, d: 15, h: 18.2, seed: 96.6, snowLine: 0.38 },
      { angle: 3.16, dist: 59, w: 24, d: 15, h: 19.4, seed: 105.3, snowLine: 0.37 },
      { angle: 3.64, dist: 45, w: 15, d: 11, h: 10.8, seed: 114.8, snowLine: 0.45 }
    ];

    massifSpecs.forEach((spec, idx) => {
      const cx = Math.cos(spec.angle) * spec.dist;
      const cz = Math.sin(spec.angle) * spec.dist;
      const rotY = -spec.angle + Math.PI * 0.5 + (idx % 2 === 0 ? 0.18 : -0.16);

      this.mountainFootprints.push({
        x: cx,
        z: cz,
        r: Math.max(spec.w, spec.d) * 0.46
      });

      const geo = createRuggedMassifGeometry({
        cx,
        cz,
        rotY,
        width: spec.w,
        depth: spec.d,
        height: spec.h,
        seed: spec.seed,
        snowLineBase: spec.snowLine
      });
      this.mountainGroup.add(new THREE.Mesh(geo, mountainMat));
    });
  }

  _buildCourtyardFence() {
    const fenceGroup = new THREE.Group();
    const fenceRadius = 14.2;
    const postCount = 44;

    const woodMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3328'),
      roughness: 0.88,
      metalness: 0.05
    });
    const capSnowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d2e2f7'),
      emissive: new THREE.Color('#16223b'),
      emissiveIntensity: 0.25,
      roughness: 0.86
    });

    const postGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.28, 10);
    const snowCapGeo = new THREE.SphereGeometry(0.145, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);

    const postInst = new THREE.InstancedMesh(postGeo, woodMat, postCount);
    const capInst = new THREE.InstancedMesh(snowCapGeo, capSnowMat, postCount);
    const dummy = new THREE.Object3D();

    const railPoints = [];
    for (let i = 0; i < postCount; i += 1) {
      const a = (i / postCount) * Math.PI * 2;
      const x = Math.cos(a) * fenceRadius;
      const z = Math.sin(a) * fenceRadius;
      const gy = getTerrainHeight(x, z);

      dummy.position.set(x, gy + 0.64, z);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, gy + 1.26, z);
      dummy.scale.set(1, 0.72, 1);
      dummy.updateMatrix();
      capInst.setMatrixAt(i, dummy.matrix);

      railPoints.push(new THREE.Vector3(x, gy, z));
    }

    postInst.instanceMatrix.needsUpdate = true;
    capInst.instanceMatrix.needsUpdate = true;
    fenceGroup.add(postInst);
    fenceGroup.add(capInst);

    // 全周 360° 闭合双层木横栏 + 顶部积雪盖条（closed = true）
    const makeClosedRail = (offsetY) =>
      new THREE.CatmullRomCurve3(
        railPoints.map((p) => new THREE.Vector3(p.x, p.y + offsetY, p.z)),
        true
      );

    const lowerRail = new THREE.Mesh(
      new THREE.TubeGeometry(makeClosedRail(0.48), 112, 0.065, 8, true),
      woodMat
    );
    const upperRail = new THREE.Mesh(
      new THREE.TubeGeometry(makeClosedRail(0.98), 112, 0.075, 8, true),
      woodMat
    );
    const topSnowStrip = new THREE.Mesh(
      new THREE.TubeGeometry(makeClosedRail(1.06), 112, 0.088, 8, true),
      capSnowMat
    );
    topSnowStrip.scale.set(1, 0.72, 1);

    fenceGroup.add(lowerRail);
    fenceGroup.add(upperRail);
    fenceGroup.add(topSnowStrip);

    this.group.add(fenceGroup);
  }

  _buildDistantCottages() {
    const wallMatA = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2b3348'),
      roughness: 0.88,
      metalness: 0.06
    });
    const wallMatB = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3a3146'),
      roughness: 0.88,
      metalness: 0.06
    });
    const roofSnowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cadbf2'),
      emissive: new THREE.Color('#132036'),
      emissiveIntensity: 0.28,
      roughness: 0.85
    });
    const chimneyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#393f54'),
      roughness: 0.9
    });

    // 10 座暖窗积雪木屋自然分布在 360° 雪谷林间，任意视角旋转都不再空旷
    const cottageSpecs = [
      { angle: 0.38, dist: 24.5, w: 2.15, h: 1.42, d: 1.8 },
      { angle: 1.05, dist: 27.0, w: 1.95, h: 1.32, d: 1.65 },
      { angle: 1.92, dist: 25.5, w: 2.1, h: 1.38, d: 1.75 },
      { angle: 2.65, dist: 23.0, w: 2.25, h: 1.48, d: 1.85 },
      { angle: 3.35, dist: 24.5, w: 2.0, h: 1.35, d: 1.7 },
      { angle: 4.02, dist: 26.5, w: 2.2, h: 1.45, d: 1.85 },
      { angle: 4.55, dist: 29.0, w: 1.95, h: 1.3, d: 1.65 },
      { angle: 5.05, dist: 28.0, w: 2.1, h: 1.4, d: 1.75 },
      { angle: 5.62, dist: 23.5, w: 2.2, h: 1.44, d: 1.8 },
      { angle: 6.08, dist: 27.5, w: 2.0, h: 1.34, d: 1.68 }
    ];

    cottageSpecs.forEach((cfg, idx) => {
      const cx = Math.cos(cfg.angle) * cfg.dist;
      const cz = Math.sin(cfg.angle) * cfg.dist;
      const groundY = getTerrainHeight(cx, cz) - 0.16;
      // 正面朝向圣诞树广场中心，略微带一点自然偏角
      const rotY = Math.atan2(-cx, -cz) + (idx % 2 === 0 ? 0.18 : -0.18);

      this.cottageFootprints.push({ x: cx, z: cz, r: Math.max(cfg.w, cfg.d) * 1.35 });

      const house = new THREE.Group();
      house.position.set(cx, groundY, cz);
      house.rotation.y = rotY;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
        idx % 2 === 0 ? wallMatA : wallMatB
      );
      body.position.y = cfg.h * 0.5;
      house.add(body);

      const roofH = cfg.h * 0.78;
      const roofR = Math.hypot(cfg.w, cfg.d) * 0.58;
      const roofGeo = new THREE.ConeGeometry(roofR, roofH, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, roofSnowMat);
      roof.position.y = cfg.h + roofH * 0.44;
      roof.scale.set(
        cfg.w / Math.max(cfg.w, cfg.d) + 0.16,
        1,
        cfg.d / Math.max(cfg.w, cfg.d) + 0.16
      );
      house.add(roof);

      const chimH = roofH * 0.62;
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.24, chimH, 0.24), chimneyMat);
      const lx = cfg.w * 0.24;
      const ly = cfg.h + roofH * 0.62;
      const lz = -cfg.d * 0.14;
      chim.position.set(lx, ly, lz);
      house.add(chim);

      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      this.chimneyTips.push({
        x: cx + lx * cosR + lz * sinR,
        y: groundY + ly + chimH * 0.52,
        z: cz - lx * sinR + lz * cosR
      });

      const winMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffd991'),
        emissive: new THREE.Color('#ffbe52'),
        emissiveIntensity: 0.82,
        roughness: 0.3
      });
      this.windowEntries.push({ mat: winMat, phase: idx * 1.1 });

      [-cfg.w * 0.23, cfg.w * 0.23].forEach((wx) => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.36), winMat);
        win.position.set(wx, cfg.h * 0.55, cfg.d * 0.506);
        house.add(win);
      });

      const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.34), winMat);
      sideWin.position.set(cfg.w * 0.506, cfg.h * 0.55, 0);
      sideWin.rotation.y = Math.PI / 2;
      house.add(sideWin);

      this.group.add(house);
    });
  }

  _buildPineForest() {
    const placements = [];

    const tryPushTree = (r, a, scaleMin, scaleMax) => {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const hitsCottage = this.cottageFootprints.some(
        (fp) => Math.hypot(x - fp.x, z - fp.z) < fp.r + 1.25
      );
      if (hitsCottage) return false;
      const hitsMountain = this.mountainFootprints.some(
        (fp) => Math.hypot(x - fp.x, z - fp.z) < fp.r + 1.0
      );
      if (hitsMountain) return false;
      placements.push({
        x,
        y: getTerrainHeight(x, z) - 0.14,
        z,
        scale: scaleMin + this.rng() * (scaleMax - scaleMin),
        rotY: this.rng() * Math.PI * 2
      });
      return true;
    };

    // 第 1 圈（r = 16.0 ~ 20.2）：紧贴 360° 木栅栏外侧的 48 棵茂密雪松
    const ring1Count = 48;
    for (let i = 0; i < ring1Count; i += 1) {
      const a = (i / ring1Count) * Math.PI * 2 + (this.rng() - 0.5) * 0.08;
      const r = 16.0 + this.rng() * 4.2;
      tryPushTree(r, a, 0.92, 1.38);
    }

    // 第 2 圈（r = 21.0 ~ 32.0）：穿插在木屋与雪坡之间的 74 棵森林树群
    let ring2Added = 0;
    let guard2 = 0;
    while (ring2Added < 74 && guard2 < 260) {
      guard2 += 1;
      const a = this.rng() * Math.PI * 2;
      const r = 21.0 + this.rng() * 11.0;
      if (tryPushTree(r, a, 1.0, 1.56)) ring2Added += 1;
    }

    // 第 3 圈（r = 32.5 ~ 42.5）：山谷山口与山麓坡地间的 60 棵高大高山松
    let ring3Added = 0;
    let guard3 = 0;
    while (ring3Added < 60 && guard3 < 240) {
      guard3 += 1;
      const a = this.rng() * Math.PI * 2;
      const r = 32.5 + this.rng() * 10.0;
      if (tryPushTree(r, a, 1.15, 1.78)) ring3Added += 1;
    }

    const count = placements.length;
    const snowyPineTex = createSnowyPineTexture();
    const pineMat = new THREE.MeshStandardMaterial({
      map: snowyPineTex,
      roughness: 0.88,
      metalness: 0.04,
      emissive: new THREE.Color('#132136'),
      emissiveIntensity: 0.28
    });

    // 4 层垂坠花瓣松枝错落叠起，每层旋转错开相位，让稀疏碎雪从树底到树梢自然散落（仅 4 次绘制调用）
    const tierConfigs = [
      { radius: 1.24, height: 1.65, lobes: 8, yOffset: 0.84, rotOffset: 0.0 },
      { radius: 1.02, height: 1.50, lobes: 7, yOffset: 1.64, rotOffset: 1.57 },
      { radius: 0.78, height: 1.35, lobes: 7, yOffset: 2.38, rotOffset: 3.14 },
      { radius: 0.52, height: 1.18, lobes: 6, yOffset: 3.04, rotOffset: 4.71 }
    ];

    const tierMeshes = tierConfigs.map((cfg) => {
      const geo = createPineTierGeometry(cfg.radius, cfg.height, cfg.lobes);
      return new THREE.InstancedMesh(geo, pineMat, count);
    });

    const dummy = new THREE.Object3D();
    placements.forEach((p, idx) => {
      dummy.scale.setScalar(p.scale);
      tierConfigs.forEach((cfg, tIdx) => {
        dummy.rotation.set(0, p.rotY + cfg.rotOffset, 0);
        dummy.position.set(p.x, p.y + cfg.yOffset * p.scale, p.z);
        dummy.updateMatrix();
        tierMeshes[tIdx].setMatrixAt(idx, dummy.matrix);
      });
    });

    tierMeshes.forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      this.group.add(m);
    });
  }

  _buildChimneySmoke(dotTexture) {
    const puffsPerChimney = 4;
    const total = this.chimneyTips.length * puffsPerChimney;
    const positions = new Float32Array(total * 3);

    this.chimneyTips.forEach((tip, cIdx) => {
      for (let p = 0; p < puffsPerChimney; p += 1) {
        const idx = cIdx * puffsPerChimney + p;
        const life = p / puffsPerChimney;
        this.smokeItems.push({
          origin: tip,
          life,
          speed: 0.13 + this.rng() * 0.05,
          driftPhase: this.rng() * Math.PI * 2
        });
        positions[idx * 3] = tip.x;
        positions[idx * 3 + 1] = tip.y + life * 2.2;
        positions[idx * 3 + 2] = tip.z;
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.4,
      map: dotTexture,
      color: new THREE.Color('#a8bede'),
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    });

    this.smokePoints = new THREE.Points(geo, mat);
    this.group.add(this.smokePoints);
  }

  _buildStreetlamps() {
    // 围绕雪地庭院均匀对称分布 6 盏雪顶暖光路灯（任意角度旋转都对称好看）
    const lampCount = 6;
    const lampRadius = 10.2;

    const ironMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1f2638'),
      roughness: 0.65,
      metalness: 0.5
    });
    const redRibbonMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8374b'),
      emissive: new THREE.Color('#420b14'),
      emissiveIntensity: 0.35,
      roughness: 0.5
    });
    const lampSnowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dce9fa'),
      emissive: new THREE.Color('#1a2640'),
      emissiveIntensity: 0.28,
      roughness: 0.8
    });
    const glassBulbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff2bf'),
      emissive: new THREE.Color('#ffd369'),
      emissiveIntensity: 1.35,
      roughness: 0.15
    });

    const glowTexture = createWarmGlowTexture();
    const bulbHaloMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color('#ffe08c'),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const groundPoolMat = new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: new THREE.Color('#ffd980'),
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < lampCount; i += 1) {
      const a = Math.PI / 6 + (i / lampCount) * Math.PI * 2;
      const lx = Math.cos(a) * lampRadius;
      const lz = Math.sin(a) * lampRadius;
      const gy = getTerrainHeight(lx, lz);

      const lamp = new THREE.Group();
      lamp.position.set(lx, gy, lz);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.35, 14), ironMat);
      base.position.y = 0.175;
      lamp.add(base);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 2.55, 14), ironMat);
      post.position.y = 1.45;
      lamp.add(post);

      const ribbonWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.24, 14), redRibbonMat);
      ribbonWrap.position.y = 1.55;
      lamp.add(ribbonWrap);

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.12, 12), ironMat);
      collar.position.y = 2.72;
      lamp.add(collar);

      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.44, 12), glassBulbMat);
      glass.position.y = 2.98;
      lamp.add(glass);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 12), ironMat);
      roof.position.y = 3.28;
      lamp.add(roof);

      const snowCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        lampSnowMat
      );
      snowCap.position.y = 3.25;
      snowCap.scale.set(1, 0.72, 1);
      lamp.add(snowCap);

      const halo = new THREE.Sprite(bulbHaloMat);
      halo.position.y = 2.98;
      halo.scale.set(2.3, 2.3, 1);
      lamp.add(halo);

      const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), groundPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.04;
      lamp.add(pool);

      this.group.add(lamp);
    }
  }

  _buildSnowman() {
    const sx = 4.45;
    const sz = -0.8;
    const sy = getTerrainHeight(sx, sz);

    const snowman = new THREE.Group();
    snowman.position.set(sx, sy, sz);
    snowman.rotation.y = -0.35;

    const bodySnowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dce8f9'),
      emissive: new THREE.Color('#1d2842'),
      emissiveIntensity: 0.28,
      roughness: 0.8
    });
    const hatMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#202534'),
      roughness: 0.75
    });
    const scarfMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cf344a'),
      emissive: new THREE.Color('#3b0912'),
      emissiveIntensity: 0.3,
      roughness: 0.65
    });
    const coalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#151822'),
      roughness: 0.7
    });
    const carrotMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f27d29'),
      emissive: new THREE.Color('#3d1904'),
      emissiveIntensity: 0.25,
      roughness: 0.55
    });
    const twigMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3222'),
      roughness: 0.9
    });

    const baseBall = new THREE.Mesh(new THREE.SphereGeometry(0.58, 22, 16), bodySnowMat);
    baseBall.position.y = 0.52;
    baseBall.scale.set(1, 0.9, 1);
    snowman.add(baseBall);

    const torsoBall = new THREE.Mesh(new THREE.SphereGeometry(0.43, 22, 16), bodySnowMat);
    torsoBall.position.y = 1.28;
    torsoBall.scale.set(1, 0.92, 1);
    snowman.add(torsoBall);

    const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.32, 22, 16), bodySnowMat);
    headBall.position.y = 1.88;
    snowman.add(headBall);

    const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 10, 22), scarfMat);
    scarfCollar.rotation.x = Math.PI / 2;
    scarfCollar.position.y = 1.62;
    snowman.add(scarfCollar);

    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.06), scarfMat);
    scarfTail.position.set(0.18, 1.42, 0.26);
    scarfTail.rotation.set(-0.22, 0.15, -0.24);
    snowman.add(scarfTail);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), hatMat);
    brim.position.y = 2.16;
    brim.rotation.z = -0.05;
    snowman.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.36, 20), hatMat);
    crown.position.set(0.01, 2.34, 0);
    crown.rotation.z = -0.05;
    snowman.add(crown);

    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.07, 20), scarfMat);
    hatBand.position.set(0.005, 2.21, 0);
    hatBand.rotation.z = -0.05;
    snowman.add(hatBand);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 10), carrotMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.87, 0.38);
    snowman.add(nose);

    [-0.1, 0.1].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), coalMat);
      eye.position.set(ex, 1.95, 0.285);
      snowman.add(eye);
    });
    [1.36, 1.18, 0.72].forEach((by, idx) => {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), coalMat);
      btn.position.set(0, by, idx === 2 ? 0.55 : 0.41);
      snowman.add(btn);
    });

    [-1, 1].forEach((dir) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 8), twigMat);
      arm.position.set(dir * 0.54, 1.44, 0.05);
      arm.rotation.z = dir * -0.92;
      snowman.add(arm);
    });

    this.group.add(snowman);
  }

  _buildMoonAndClouds() {
    const moonTex = createFullMoonTexture();
    this.moonMat = new THREE.SpriteMaterial({
      map: moonTex,
      color: new THREE.Color('#fff9ea'),
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      fog: false
    });
    this.moonSprite = new THREE.Sprite(this.moonMat);
    this.moonSprite.position.set(-16.5, 24.5, -86);
    this.moonSprite.scale.set(8.2, 8.2, 1);
    this.group.add(this.moonSprite);

    const darkCloudTexA = createDarkNightCloudTexture(0);
    const darkCloudTexB = createDarkNightCloudTexture(1);

    // 15 朵围绕 360° 夜空的写实墨蓝黑云（位于群星之前、远山之后，轻遮星点更有真实现场感）
    const cloudConfigs = [
      { angle: -2.18, r: 76, y: 17.5, sx: 36, sy: 10.5, op: 0.78, speed: 0.0045, variant: 0 },
      { angle: -1.84, r: 81, y: 27.5, sx: 32, sy: 9.2, op: 0.68, speed: 0.0036, variant: 1 },
      { angle: -1.34, r: 75, y: 20.5, sx: 38, sy: 11.0, op: 0.76, speed: 0.0042, variant: 0 },
      { angle: -1.02, r: 80, y: 31.0, sx: 34, sy: 9.5, op: 0.64, speed: 0.0032, variant: 1 },
      { angle: -0.62, r: 77, y: 18.0, sx: 36, sy: 10.2, op: 0.74, speed: 0.004, variant: 0 },
      { angle: -0.18, r: 83, y: 25.0, sx: 40, sy: 11.4, op: 0.72, speed: 0.0035, variant: 1 },
      { angle: 0.28, r: 74, y: 16.5, sx: 35, sy: 10.0, op: 0.78, speed: 0.0044, variant: 0 },
      { angle: 0.72, r: 79, y: 29.0, sx: 33, sy: 9.4, op: 0.66, speed: 0.0033, variant: 1 },
      { angle: 1.18, r: 76, y: 19.5, sx: 37, sy: 10.8, op: 0.75, speed: 0.0041, variant: 0 },
      { angle: 1.62, r: 82, y: 24.5, sx: 39, sy: 11.2, op: 0.7, speed: 0.0037, variant: 1 },
      { angle: 2.08, r: 75, y: 17.0, sx: 35, sy: 9.8, op: 0.76, speed: 0.0043, variant: 0 },
      { angle: 2.54, r: 81, y: 32.5, sx: 34, sy: 9.6, op: 0.64, speed: 0.0031, variant: 1 },
      { angle: 2.98, r: 77, y: 21.0, sx: 38, sy: 10.8, op: 0.74, speed: 0.0039, variant: 0 },
      { angle: 3.44, r: 84, y: 26.5, sx: 36, sy: 10.2, op: 0.68, speed: 0.0034, variant: 1 },
      { angle: 3.84, r: 78, y: 34.5, sx: 32, sy: 9.0, op: 0.62, speed: 0.0038, variant: 0 }
    ];

    cloudConfigs.forEach((c, idx) => {
      const mat = new THREE.SpriteMaterial({
        map: c.variant === 0 ? darkCloudTexA : darkCloudTexB,
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: c.op,
        blending: THREE.NormalBlending,
        depthWrite: false,
        fog: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(Math.cos(c.angle) * c.r, c.y, Math.sin(c.angle) * c.r);
      sprite.scale.set(c.sx, c.sy, 1);
      sprite.userData = {
        angle: c.angle,
        radius: c.r,
        baseY: c.y,
        speed: c.speed,
        bobPhase: idx * 0.9
      };
      this.cloudSprites.push(sprite);
      this.group.add(sprite);
    });
  }

  setColors(colors) {
    const skyTint = new THREE.Color(colors.skyBottom);
    const vortexTint = new THREE.Color(colors.vortexColor);

    this.snowMat.color.set('#97a8cc').lerp(vortexTint, 0.16);
    this.snowMat.emissive.copy(skyTint).multiplyScalar(0.36);
    this.glintMat.color.set('#dce8ff').lerp(vortexTint, 0.25);

    if (this.moonMat) {
      this.moonMat.color.set('#fff9ea').lerp(vortexTint, 0.08);
    }
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  update(elapsed, delta) {
    if (!this.group.visible) return;

    for (let i = 0; i < this.windowEntries.length; i += 1) {
      const entry = this.windowEntries[i];
      entry.mat.emissiveIntensity = 0.78 + 0.14 * Math.sin(elapsed * 1.15 + entry.phase);
    }

    const pos = this.smokePoints.geometry.attributes.position.array;
    for (let i = 0; i < this.smokeItems.length; i += 1) {
      const item = this.smokeItems[i];
      item.life += item.speed * delta;
      if (item.life >= 1) item.life -= 1;

      const h = item.life * 2.2;
      const swayX = Math.sin(elapsed * 0.7 + item.driftPhase + item.life * 3.0) * 0.2 * item.life;
      const swayZ = Math.cos(elapsed * 0.55 + item.driftPhase) * 0.15 * item.life;

      pos[i * 3] = item.origin.x + swayX;
      pos[i * 3 + 1] = item.origin.y + h;
      pos[i * 3 + 2] = item.origin.z + swayZ;
    }
    this.smokePoints.geometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < this.cloudSprites.length; i += 1) {
      const sprite = this.cloudSprites[i];
      const d = sprite.userData;
      const a = d.angle + elapsed * d.speed;
      sprite.position.set(
        Math.cos(a) * d.radius,
        d.baseY + Math.sin(elapsed * 0.15 + d.bobPhase) * 0.4,
        Math.sin(a) * d.radius
      );
    }
  }
}
