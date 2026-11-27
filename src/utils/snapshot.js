/**
 * 高清贺卡截图导出工具
 * --------------------------------------------------
 * 将 3D WebGL 圣诞树画布与祝福文字合成为一张可直接发朋友圈/做壁纸的 PNG 图片
 */

function getCanvasFontPair(fontStyle) {
  switch (fontStyle) {
    case 'elegant':
      return {
        main: '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif',
        sub: '"Cormorant Garamond", "Times New Roman", serif'
      };
    case 'neon':
      return {
        main: '"Zhi Mang Xing", "Ma Shan Zheng", "Kaiti SC", "KaiTi", cursive',
        sub: '"Great Vibes", "Snell Roundhand", cursive'
      };
    case 'calligraphy':
    default:
      return {
        main: '"Ma Shan Zheng", "Kaiti SC", "STKaiti", "KaiTi", cursive',
        sub: '"Great Vibes", "Cormorant Garamond", cursive'
      };
  }
}

/**
 * 导出包含圣诞树与双行祝福文字的 PNG 图片
 */
export function exportHolidayCard(app, config) {
  // 先强制渲染最新一帧，确保 WebGL 缓冲区内容完整
  app.renderOnce();

  const sourceCanvas = app.getCanvas();
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');

  // 1. 填充深色夜空背景，避免透明通道导致黑边异常
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, config.colors.skyTop);
  bg.addColorStop(1, config.colors.skyBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // 2. 绘制 3D 圣诞树画面
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  // 3. 在树顶上方居中绘制祝福文字（复刻示例图优雅排版）
  const { mainText, subText, sender, fontStyle, textColor, subTextColor } = config.greeting;
  const fonts = getCanvasFontPair(fontStyle);
  const minSide = Math.min(width, height);
  const isPortrait = height >= width;
  const anchorY = isPortrait ? height * 0.165 : height * 0.135;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let cursorY = anchorY;

  if (mainText) {
    const mainSize = Math.round(Math.max(24, minSide * (isPortrait ? 0.056 : 0.044)));
    ctx.font = `400 ${mainSize}px ${fonts.main}`;
    ctx.fillStyle = textColor;
    ctx.shadowColor = textColor;
    ctx.shadowBlur = mainSize * 0.45;
    ctx.fillText(mainText, width / 2, cursorY);
    cursorY += mainSize * 1.18;
  }

  if (subText) {
    const subSize = Math.round(Math.max(22, minSide * (isPortrait ? 0.052 : 0.042)));
    ctx.font = `italic 400 ${subSize}px ${fonts.sub}`;
    ctx.fillStyle = subTextColor;
    ctx.shadowColor = subTextColor;
    ctx.shadowBlur = subSize * 0.42;
    ctx.fillText(subText, width / 2, cursorY);
    cursorY += subSize * 0.92;
  }

  if (sender) {
    const senderSize = Math.round(Math.max(14, minSide * 0.024));
    ctx.font = `300 ${senderSize}px ${fonts.main}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.shadowColor = textColor;
    ctx.shadowBlur = 10;
    ctx.fillText(sender, width / 2, cursorY + senderSize * 0.35);
  }

  ctx.restore();

  // 4. 触发浏览器下载
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const link = document.createElement('a');
  link.download = `christmas-tree-${stamp}.png`;
  link.href = outCanvas.toDataURL('image/png');
  link.click();
}
