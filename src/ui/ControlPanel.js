/**
 * 客制化交互控制面板与祝福文字同步控制器
 * --------------------------------------------------
 * 管理所有按钮、取色器、特效开关、祝福语输入、链接分享、二维码与存图交互。
 */

import QRCode from 'qrcode';
import {
  PRESETS,
  TOPPER_OPTIONS,
  FONT_OPTIONS,
  MUSIC_OPTIONS,
  createDefaultConfig
} from '../config/presets.js';
import { buildShareUrl } from '../utils/share.js';
import { exportHolidayCard } from '../utils/snapshot.js';

export class ControlPanel {
  constructor(config, isGiftMode, onChange, app) {
    this.config = config;
    this.isGiftMode = isGiftMode;
    this.onChange = onChange;
    this.app = app;
    this.toastTimer = null;

    this._cacheElements();
    this._renderDynamicChips();
    this._bindEvents();
    this.syncUI();
    this.setGiftMode(isGiftMode);
  }

  _cacheElements() {
    this.el = {
      greetingOverlay: document.getElementById('greeting-overlay'),
      greetingMain: document.getElementById('greeting-main'),
      greetingSub: document.getElementById('greeting-sub'),
      greetingSender: document.getElementById('greeting-sender'),

      floatingActions: document.getElementById('floating-actions'),
      giftActions: document.getElementById('gift-actions'),
      btnToggleMusic: document.getElementById('btn-toggle-music'),
      btnGiftMusic: document.getElementById('btn-gift-music'),
      btnToggleDrawer: document.getElementById('btn-toggle-drawer'),
      btnCloseDrawer: document.getElementById('btn-close-drawer'),
      btnQuickSnapshot: document.getElementById('btn-quick-snapshot'),
      btnQuickShare: document.getElementById('btn-quick-share'),
      btnGiftSnapshot: document.getElementById('btn-gift-snapshot'),
      btnGiftRemix: document.getElementById('btn-gift-remix'),

      tabs: Array.from(document.querySelectorAll('.tab-btn')),
      panels: Array.from(document.querySelectorAll('.tab-panel')),

      presetGrid: document.getElementById('preset-grid'),
      topperGrid: document.getElementById('topper-grid'),
      fontGrid: document.getElementById('font-grid'),
      songGrid: document.getElementById('song-grid'),

      colorInputs: {
        treePrimary: document.getElementById('color-treePrimary'),
        treeSecondary: document.getElementById('color-treeSecondary'),
        ribbonColor: document.getElementById('color-ribbonColor'),
        topperColor: document.getElementById('color-topperColor'),
        vortexColor: document.getElementById('color-vortexColor'),
        treeDeep: document.getElementById('color-treeDeep')
      },

      fxInputs: {
        music: document.getElementById('fx-music'),
        rhythmLights: document.getElementById('fx-rhythmLights'),
        fireworks: document.getElementById('fx-fireworks'),
        ribbon: document.getElementById('fx-ribbon'),
        vortex: document.getElementById('fx-vortex'),
        snow: document.getElementById('fx-snow'),
        stars: document.getElementById('fx-stars'),
        bloom: document.getElementById('fx-bloom'),
        autoRotate: document.getElementById('fx-autoRotate')
      },
      bloomSlider: document.getElementById('fx-bloomStrength'),
      bloomValue: document.getElementById('bloom-value'),

      mainText: document.getElementById('input-mainText'),
      subText: document.getElementById('input-subText'),
      sender: document.getElementById('input-sender'),
      textColor: document.getElementById('color-textColor'),
      subTextColor: document.getElementById('color-subTextColor'),

      btnCopyLink: document.getElementById('btn-copy-link'),
      btnShowQr: document.getElementById('btn-show-qr'),
      btnSaveCard: document.getElementById('btn-save-card'),
      btnResetDefault: document.getElementById('btn-reset-default'),

      qrModal: document.getElementById('qr-modal'),
      qrCanvas: document.getElementById('qr-canvas'),
      btnCloseQr: document.getElementById('btn-close-qr'),
      btnModalCopy: document.getElementById('btn-modal-copy'),
      btnModalPreviewGift: document.getElementById('btn-modal-preview-gift'),

      introOverlay: document.getElementById('intro-overlay'),
      igniteIcon: document.getElementById('ignite-icon'),
      introKicker: document.getElementById('intro-kicker'),
      btnIgnite: document.getElementById('btn-ignite'),
      btnReplayIntro: document.getElementById('btn-replay-intro'),

      toast: document.getElementById('toast')
    };
  }

  _renderDynamicChips() {
    // 1. 渲染 5 套精选配色卡片
    this.el.presetGrid.innerHTML = '';
    Object.values(PRESETS).forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-card';
      btn.dataset.preset = preset.id;
      btn.innerHTML = `
        <span class="preset-left">
          <span class="preset-orb" style="background: linear-gradient(135deg, ${preset.colors.treePrimary}, ${preset.colors.ribbonColor});"></span>
          <span class="preset-name">${preset.name}</span>
        </span>
        <span class="preset-tag">${preset.tag}</span>
      `;
      btn.addEventListener('click', () => this._applyPreset(preset.id));
      this.el.presetGrid.appendChild(btn);
    });

    // 2. 渲染树顶造型按钮
    this.el.topperGrid.innerHTML = '';
    TOPPER_OPTIONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.dataset.topper = opt.id;
      btn.innerHTML = `<span class="chip-icon">${opt.icon}</span><span>${opt.label}</span>`;
      btn.addEventListener('click', () => {
        this.config.topper = opt.id;
        this._commit();
      });
      this.el.topperGrid.appendChild(btn);
    });

    // 3. 渲染字体风格按钮
    this.el.fontGrid.innerHTML = '';
    FONT_OPTIONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.dataset.font = opt.id;
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        this.config.greeting.fontStyle = opt.id;
        this._commit();
      });
      this.el.fontGrid.appendChild(btn);
    });

    // 4. 渲染八音盒曲目按钮
    this.el.songGrid.innerHTML = '';
    MUSIC_OPTIONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.dataset.song = opt.id;
      btn.innerHTML = `<span class="chip-icon">${opt.icon}</span><span>${opt.label}</span>`;
      btn.addEventListener('click', () => {
        this.config.effects.musicTrack = opt.id;
        this.config.effects.music = true;
        this.app.setMusicTrack(opt.id);
        this._commit();
      });
      this.el.songGrid.appendChild(btn);
    });
  }

  _bindEvents() {
    // 抽屉开合
    this.el.btnToggleDrawer.addEventListener('click', () => this.openDrawer());
    this.el.btnCloseDrawer.addEventListener('click', () => this.closeDrawer());

    // 顶部音乐快捷开关（在点击手势内同步解锁播放 / 静音）
    const handleMusicToggle = () => {
      const next = !this.app.isMusicPlaying();
      this.config.effects.music = next;
      this.app.setMusicEnabled(next);
      this.syncUI();
      this.showToast(next ? '🎵 八音盒圣诞音乐已开启' : '🔇 已关闭八音盒音乐');
    };
    this.el.btnToggleMusic.addEventListener('click', handleMusicToggle);
    this.el.btnGiftMusic.addEventListener('click', handleMusicToggle);
    this.app.onMusicStateChange = () => this._syncMusicButtons();

    // 礼物模式按钮
    this.el.btnGiftRemix.addEventListener('click', () => {
      this.setGiftMode(false);
      this.openDrawer();
      this.showToast('✨ 已切换至创作模式，自由打造你的专属圣诞树吧！');
    });
    this.el.btnGiftSnapshot.addEventListener('click', () => this._handleSnapshot());

    // 快捷存图与分享
    this.el.btnQuickSnapshot.addEventListener('click', () => this._handleSnapshot());
    this.el.btnQuickShare.addEventListener('click', () => this._handleCopyShareLink());

    // 三分页切换
    this.el.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this.el.tabs.forEach((t) => {
          const active = t.dataset.tab === target;
          t.classList.toggle('active', active);
          t.setAttribute('aria-selected', String(active));
        });
        this.el.panels.forEach((p) => {
          p.classList.toggle('active', p.dataset.panel === target);
        });
      });
    });

    // 自定义颜色实时联动
    Object.entries(this.el.colorInputs).forEach(([key, input]) => {
      input.addEventListener('input', () => {
        this.config.preset = 'custom';
        this.config.colors[key] = input.value;
        this._commit();
      });
    });

    // 特效开关实时联动
    Object.entries(this.el.fxInputs).forEach(([key, input]) => {
      input.addEventListener('change', () => {
        this.config.effects[key] = input.checked;
        if (key === 'music') {
          this.app.setMusicEnabled(input.checked);
        }
        this._commit();
      });
    });

    this.el.bloomSlider.addEventListener('input', () => {
      const val = Number(this.el.bloomSlider.value);
      this.config.effects.bloomStrength = val;
      this.el.bloomValue.textContent = val.toFixed(2);
      this._commit();
    });

    // 祝福文字与颜色实时联动
    this.el.mainText.addEventListener('input', () => {
      this.config.greeting.mainText = this.el.mainText.value;
      this._commit();
    });
    this.el.subText.addEventListener('input', () => {
      this.config.greeting.subText = this.el.subText.value;
      this._commit();
    });
    this.el.sender.addEventListener('input', () => {
      this.config.greeting.sender = this.el.sender.value;
      this._commit();
    });
    this.el.textColor.addEventListener('input', () => {
      this.config.greeting.textColor = this.el.textColor.value;
      this._commit();
    });
    this.el.subTextColor.addEventListener('input', () => {
      this.config.greeting.subTextColor = this.el.subTextColor.value;
      this._commit();
    });

    // 分享、二维码、存图、重置
    this.el.btnCopyLink.addEventListener('click', () => this._handleCopyShareLink());
    this.el.btnShowQr.addEventListener('click', () => this._openQrModal());
    this.el.btnSaveCard.addEventListener('click', () => this._handleSnapshot());
    this.el.btnResetDefault.addEventListener('click', () => {
      const fresh = createDefaultConfig();
      Object.assign(this.config, fresh);
      this._commit();
      this.showToast('↺ 已恢复默认示例同款配置');
    });

    // 二维码弹窗操作
    this.el.btnCloseQr.addEventListener('click', () => this._closeQrModal());
    this.el.qrModal.addEventListener('click', (e) => {
      if (e.target === this.el.qrModal) this._closeQrModal();
    });
    this.el.btnModalCopy.addEventListener('click', () => this._handleCopyShareLink());
    this.el.btnModalPreviewGift.addEventListener('click', () => {
      this._closeQrModal();
      this.setGiftMode(true);
      this.enterIntroMode();
      this.showToast('🎁 正在以朋友视角预览开箱礼物模式');
    });

    // 开场点亮仪式：点击覆盖层任意处、按钮或按空格/回车均可触发
    const handleIgnite = (e) => {
      e.stopPropagation();
      this.triggerIgnite();
    };
    this.el.introOverlay.addEventListener('click', handleIgnite);
    this.el.btnIgnite.addEventListener('click', handleIgnite);
    this.el.introOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.triggerIgnite();
      }
    });

    this.el.btnReplayIntro.addEventListener('click', () => {
      this.enterIntroMode();
    });
  }

  _applyPreset(presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return;
    this.config.preset = preset.id;
    this.config.colors = { ...preset.colors };
    this.config.greeting.textColor = preset.textColor;
    this.config.greeting.subTextColor = preset.subTextColor;
    this._commit();
  }

  _commit() {
    this.syncUI();
    this.onChange(this.config);
  }

  /**
   * 把当前配置完整同步到祝福文字和所有表单控件上
   */
  syncUI() {
    const { colors, topper, effects, greeting, preset } = this.config;

    // 更新祝福文字内容、字体与发光色
    this.el.greetingMain.textContent = greeting.mainText;
    this.el.greetingMain.hidden = !greeting.mainText.trim();

    this.el.greetingSub.textContent = greeting.subText;
    this.el.greetingSub.hidden = !greeting.subText.trim();

    this.el.greetingSender.textContent = greeting.sender;
    this.el.greetingSender.hidden = !greeting.sender.trim();

    this.el.greetingOverlay.className = `font-${greeting.fontStyle}`;
    document.documentElement.style.setProperty('--text-main', greeting.textColor);
    document.documentElement.style.setProperty('--text-sub', greeting.subTextColor);

    // 同步开场仪式图标与引导语
    const activeTopper = TOPPER_OPTIONS.find((o) => o.id === topper);
    this.el.igniteIcon.textContent = activeTopper ? activeTopper.icon : '💖';
    this._updateIntroKicker();

    // 同步预设高亮
    this.el.presetGrid.querySelectorAll('.preset-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.preset === preset);
    });

    // 同步树顶高亮
    this.el.topperGrid.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.topper === topper);
    });

    // 同步字体高亮
    this.el.fontGrid.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.font === greeting.fontStyle);
    });

    // 同步曲目高亮与顶部音乐按钮状态
    this.el.songGrid.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.song === effects.musicTrack);
    });
    this._syncMusicButtons();

    // 同步颜色选择器
    Object.entries(this.el.colorInputs).forEach(([key, input]) => {
      input.value = colors[key];
    });

    // 同步特效开关与辉光滑块
    Object.entries(this.el.fxInputs).forEach(([key, input]) => {
      input.checked = Boolean(effects[key]);
    });
    this.el.bloomSlider.value = String(effects.bloomStrength);
    this.el.bloomValue.textContent = Number(effects.bloomStrength).toFixed(2);

    // 同步祝福语输入框
    if (this.el.mainText.value !== greeting.mainText) {
      this.el.mainText.value = greeting.mainText;
    }
    if (this.el.subText.value !== greeting.subText) {
      this.el.subText.value = greeting.subText;
    }
    if (this.el.sender.value !== greeting.sender) {
      this.el.sender.value = greeting.sender;
    }
    this.el.textColor.value = greeting.textColor;
    this.el.subTextColor.value = greeting.subTextColor;
  }

  _syncMusicButtons() {
    const playing = this.app.isMusicPlaying();
    const icon = playing ? '🎵' : '🔇';
    [this.el.btnToggleMusic, this.el.btnGiftMusic].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle('music-playing', playing);
      const span = btn.querySelector('.btn-icon');
      if (span) span.textContent = icon;
    });
  }

  _updateIntroKicker() {
    if (!this.el.introKicker) return;
    if (this.isGiftMode) {
      const senderText = this.config.greeting.sender.trim();
      this.el.introKicker.textContent = senderText
        ? `${senderText} 送你一棵专属圣诞树`
        : '收到一份专属圣诞惊喜 ✨';
    } else {
      this.el.introKicker.textContent = '夜空星尘已为你就绪 ✨';
    }
  }

  enterIntroMode() {
    clearTimeout(this.introHideTimer);
    this.closeDrawer();
    document.body.classList.add('intro-pending', 'greeting-hidden');
    this.el.introOverlay.hidden = false;
    this.el.introOverlay.classList.remove('ignited');
    this._updateIntroKicker();
    this.app.resetIntro();
  }

  triggerIgnite() {
    if (this.el.introOverlay.hidden || this.el.introOverlay.classList.contains('ignited')) {
      return;
    }
    this.el.introOverlay.classList.add('ignited');
    this.introHideTimer = setTimeout(() => {
      this.el.introOverlay.hidden = true;
    }, 620);

    this.app.ignite({
      onGreetingReveal: () => {
        document.body.classList.remove('greeting-hidden');
      },
      onComplete: () => {
        document.body.classList.remove('intro-pending');
      }
    });
  }

  setGiftMode(isGift) {
    this.isGiftMode = isGift;
    document.body.classList.toggle('gift-mode', isGift);
    this.el.floatingActions.hidden = isGift;
    this.el.giftActions.hidden = !isGift;
    this._updateIntroKicker();
    if (isGift) {
      this.closeDrawer();
    }
  }

  openDrawer() {
    document.body.classList.add('drawer-open');
  }

  closeDrawer() {
    document.body.classList.remove('drawer-open');
  }

  async _handleCopyShareLink() {
    const shareUrl = buildShareUrl(this.config);
    // 同步地址栏哈希，方便直接从浏览器收藏或转发
    try {
      window.history.replaceState(null, '', shareUrl);
    } catch {
      // 忽略 file:// 等环境限制
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      this.showToast('✅ 专属分享链接已复制，快发给 TA 吧！');
    } catch {
      // 剪贴板不可用时的兼容降级
      const temp = document.createElement('textarea');
      temp.value = shareUrl;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      this.showToast('✅ 专属分享链接已复制！');
    }
  }

  async _openQrModal() {
    const shareUrl = buildShareUrl(this.config);
    this.el.qrModal.hidden = false;
    try {
      await QRCode.toCanvas(this.el.qrCanvas, shareUrl, {
        width: 220,
        margin: 1,
        color: {
          dark: '#141933',
          light: '#ffffff'
        }
      });
    } catch {
      this.showToast('⚠️ 二维码生成失败，请直接复制分享链接');
    }
  }

  _closeQrModal() {
    this.el.qrModal.hidden = true;
  }

  _handleSnapshot() {
    exportHolidayCard(this.app, this.config);
    this.showToast('📸 高清圣诞贺卡已保存到下载文件夹！');
  }

  showToast(message) {
    clearTimeout(this.toastTimer);
    this.el.toast.textContent = message;
    this.el.toast.classList.add('visible');
    this.toastTimer = setTimeout(() => {
      this.el.toast.classList.remove('visible');
    }, 2600);
  }
}
