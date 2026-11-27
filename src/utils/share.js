/**
 * 零后端分享编解码工具（URL 参数持久化）
 * --------------------------------------------------
 * 原理：把用户的配色、特效、祝福语打包成一个紧凑的 JSON，
 * 再转成对网址友好的 Base64URL 字符串拼在链接末尾（#cfg=...）。
 * 朋友打开这个链接时，网页自动解码还原出你的专属圣诞树！
 */

import { PRESETS, TOPPER_OPTIONS, FONT_OPTIONS, createDefaultConfig } from '../config/presets.js';

const VALID_HEX = /^#[0-9a-fA-F]{6}$/;
const VALID_TOPPERS = new Set(TOPPER_OPTIONS.map((o) => o.id));
const VALID_FONTS = new Set(FONT_OPTIONS.map((o) => o.id));

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function safeHex(value, fallback) {
  return typeof value === 'string' && VALID_HEX.test(value) ? value : fallback;
}

function safeText(value, fallback, maxLen = 60) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLen);
}

/**
 * 将完整配置对象编码为紧凑的 Base64URL 字符串
 */
export function encodeConfig(config) {
  // 用极短键名减小链接长度，方便微信发送和生成清晰二维码
  const compact = {
    p: config.preset,
    c: [
      config.colors.treePrimary,
      config.colors.treeSecondary,
      config.colors.treeDeep,
      config.colors.ribbonColor,
      config.colors.topperColor,
      config.colors.vortexColor,
      config.colors.skyTop,
      config.colors.skyBottom
    ],
    tp: config.topper,
    fx: [
      config.effects.fireworks ? 1 : 0,
      config.effects.snow ? 1 : 0,
      config.effects.ribbon ? 1 : 0,
      config.effects.vortex ? 1 : 0,
      config.effects.stars ? 1 : 0,
      config.effects.bloom ? 1 : 0,
      config.effects.autoRotate ? 1 : 0,
      Number(config.effects.bloomStrength ?? 0.72)
    ],
    g: [
      config.greeting.mainText ?? '',
      config.greeting.subText ?? '',
      config.greeting.sender ?? '',
      config.greeting.fontStyle ?? 'calligraphy',
      config.greeting.textColor,
      config.greeting.subTextColor
    ]
  };

  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

/**
 * 将 Base64URL 字符串解码并安全合并为完整配置对象
 */
export function decodeConfig(token) {
  const base = createDefaultConfig();
  if (!token || typeof token !== 'string') return null;

  try {
    const bytes = base64UrlToBytes(token.trim());
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;

    if (typeof data.p === 'string' && (PRESETS[data.p] || data.p === 'custom')) {
      base.preset = data.p;
    }

    if (Array.isArray(data.c)) {
      const keys = [
        'treePrimary',
        'treeSecondary',
        'treeDeep',
        'ribbonColor',
        'topperColor',
        'vortexColor',
        'skyTop',
        'skyBottom'
      ];
      keys.forEach((key, idx) => {
        base.colors[key] = safeHex(data.c[idx], base.colors[key]);
      });
    }

    if (VALID_TOPPERS.has(data.tp)) {
      base.topper = data.tp;
    }

    if (Array.isArray(data.fx)) {
      const boolKeys = [
        'fireworks',
        'snow',
        'ribbon',
        'vortex',
        'stars',
        'bloom',
        'autoRotate'
      ];
      boolKeys.forEach((key, idx) => {
        if (data.fx[idx] !== undefined) {
          base.effects[key] = Boolean(data.fx[idx]);
        }
      });
      const strength = Number(data.fx[7]);
      if (!Number.isNaN(strength)) {
        base.effects.bloomStrength = Math.min(1.5, Math.max(0.15, strength));
      }
    }

    if (Array.isArray(data.g)) {
      base.greeting.mainText = safeText(data.g[0], base.greeting.mainText, 40);
      base.greeting.subText = safeText(data.g[1], base.greeting.subText, 50);
      base.greeting.sender = safeText(data.g[2], base.greeting.sender, 32);
      if (VALID_FONTS.has(data.g[3])) {
        base.greeting.fontStyle = data.g[3];
      }
      base.greeting.textColor = safeHex(data.g[4], base.greeting.textColor);
      base.greeting.subTextColor = safeHex(data.g[5], base.greeting.subTextColor);
    }

    return base;
  } catch {
    return null;
  }
}

/**
 * 从当前页面网址中读取分享配置（同时兼容 #cfg=... 与 ?cfg=...）
 */
export function readConfigFromLocation(loc = window.location) {
  let token = '';

  if (loc.hash && loc.hash.includes('cfg=')) {
    const hashParams = new URLSearchParams(loc.hash.replace(/^#/, ''));
    token = hashParams.get('cfg') || '';
  }
  if (!token && loc.search && loc.search.includes('cfg=')) {
    const searchParams = new URLSearchParams(loc.search);
    token = searchParams.get('cfg') || '';
  }

  if (!token) {
    return { config: createDefaultConfig(), isGiftMode: false };
  }

  const decoded = decodeConfig(token);
  if (!decoded) {
    return { config: createDefaultConfig(), isGiftMode: false };
  }
  return { config: decoded, isGiftMode: true };
}

/**
 * 生成发给朋友的完整专属分享链接
 */
export function buildShareUrl(config, loc = window.location) {
  const token = encodeConfig(config);
  const cleanBase = `${loc.origin}${loc.pathname}`;
  return `${cleanBase}#cfg=${token}`;
}
