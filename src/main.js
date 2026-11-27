/**
 * 应用主入口
 * --------------------------------------------------
 * 串联 3 个核心步骤：
 * 1. 检查网址里有没有朋友发来的专属圣诞树配置（若有则自动进入“礼物观赏模式”）
 * 2. 启动 3D 发光粒子圣诞树渲染引擎
 * 3. 挂载毛玻璃定制面板并实时同步
 */

import { readConfigFromLocation } from './utils/share.js';
import { ChristmasApp } from './scene/ChristmasApp.js';
import { ControlPanel } from './ui/ControlPanel.js';

const container = document.getElementById('canvas-container');
const { config, isGiftMode } = readConfigFromLocation();

const app = new ChristmasApp(container, config);

const panel = new ControlPanel(
  config,
  isGiftMode,
  (updatedConfig) => {
    app.applyConfig(updatedConfig);
  },
  app
);

// 桌面端首次进入创作模式时默认保持画面纯净，方便先欣赏整棵树；
// 若想直接编辑，点击右上角「✨ 定制圣诞树」即可滑出抽屉。
window.addEventListener('hashchange', () => {
  const next = readConfigFromLocation();
  Object.assign(config, next.config);
  app.applyConfig(config);
  panel.syncUI();
  panel.setGiftMode(next.isGiftMode);
});
