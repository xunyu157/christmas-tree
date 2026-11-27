/**
 * 圣诞树预设主题与默认配置
 * --------------------------------------------------
 * 新手提示：想增加一套新的圣诞树配色，只需要在 PRESETS 里照着格式加一项即可！
 */

export const PRESETS = {
  'rose-glitter': {
    id: 'rose-glitter',
    name: '粉紫碎钻金',
    tag: '示例同款',
    colors: {
      treePrimary: '#cf6aa6',   // 树身浓郁紫粉主钻
      treeSecondary: '#fff3db', // 璀璨香槟银白碎钻
      treeDeep: '#24102c',      // 松枝层下深邃暗莓紫阴影（拉开立体层次）
      ribbonColor: '#ffd463',   // 醒目流光香槟金丝带
      topperColor: '#ff5599',   // 树顶饱满玫瑰粉爱心
      vortexColor: '#9ec6f5',   // 底部星河雾蓝光晕
      skyTop: '#03050d',        // 夜空顶部深蓝黑
      skyBottom: '#0a1228'      // 夜空底部微蓝黑
    },
    textColor: '#ffdbe9',
    subTextColor: '#f5d794'
  },
  'emerald-gold': {
    id: 'emerald-gold',
    name: '经典祖母绿金',
    tag: '高定经典',
    colors: {
      treePrimary: '#1ca664',
      treeSecondary: '#fff0b8',
      treeDeep: '#062617',
      ribbonColor: '#ffd24c',
      topperColor: '#ffd84d',
      vortexColor: '#8ce6c0',
      skyTop: '#030807',
      skyBottom: '#0a1e1a'
    },
    textColor: '#e9fff3',
    subTextColor: '#ffd670'
  },
  'frozen-blue': {
    id: 'frozen-blue',
    name: '冰雪星河蓝',
    tag: '冬日冰晶',
    colors: {
      treePrimary: '#4aa8ff',
      treeSecondary: '#f2faff',
      treeDeep: '#0b2142',
      ribbonColor: '#ffe08a',
      topperColor: '#7be0ff',
      vortexColor: '#91c9ff',
      skyTop: '#020612',
      skyBottom: '#0a1b3a'
    },
    textColor: '#e6f5ff',
    subTextColor: '#a9dcff'
  },
  'champagne-star': {
    id: 'champagne-star',
    name: '香槟鎏金夜',
    tag: '温暖奢华',
    colors: {
      treePrimary: '#df9f42',
      treeSecondary: '#fff9e8',
      treeDeep: '#2e1a06',
      ribbonColor: '#ffea9f',
      topperColor: '#ff7096',
      vortexColor: '#ffdfa3',
      skyTop: '#080503',
      skyBottom: '#1c130a'
    },
    textColor: '#fff2d1',
    subTextColor: '#ffd166'
  },
  'aurora-violet': {
    id: 'aurora-violet',
    name: '极光幻梦紫',
    tag: '赛博梦幻',
    colors: {
      treePrimary: '#8c5bff',
      treeSecondary: '#ccfff6',
      treeDeep: '#160936',
      ribbonColor: '#6efce5',
      topperColor: '#df80ff',
      vortexColor: '#8ee8ff',
      skyTop: '#050311',
      skyBottom: '#170b36'
    },
    textColor: '#efe2ff',
    subTextColor: '#80f7e5'
  }
};

export const TOPPER_OPTIONS = [
  { id: 'heart', label: '发光爱心', icon: '💖' },
  { id: 'star', label: '经典五角星', icon: '⭐' },
  { id: 'snowflake', label: '冰晶雪花', icon: '❄️' }
];

export const FONT_OPTIONS = [
  { id: 'calligraphy', label: '浪漫书法' },
  { id: 'elegant', label: '典雅衬线' },
  { id: 'neon', label: '星光手写' }
];

export const MUSIC_OPTIONS = [
  { id: 'we-wish', label: '祝你圣诞快乐', icon: '🎄' },
  { id: 'jingle-bells', label: '铃儿响叮当', icon: '🔔' },
  { id: 'silent-night', label: '平安夜', icon: '🌙' }
];

/**
 * 生成一份全新的默认配置对象（避免直接修改常量）
 */
export function createDefaultConfig() {
  const defaultPreset = PRESETS['rose-glitter'];
  return {
    preset: defaultPreset.id,
    colors: { ...defaultPreset.colors },
    topper: 'heart',
    effects: {
      fireworks: true,
      snow: true,
      ribbon: true,
      vortex: true,
      stars: true,
      bloom: true,
      autoRotate: true,
      bloomStrength: 0.32,
      music: true,
      rhythmLights: true,
      musicTrack: 'we-wish'
    },
    greeting: {
      mainText: '亲爱的你，天天开心',
      subText: 'Merry Christmas',
      sender: '',
      fontStyle: 'calligraphy',
      textColor: defaultPreset.textColor,
      subTextColor: defaultPreset.subTextColor
    }
  };
}
