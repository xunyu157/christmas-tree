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
      treePrimary: '#d889b8',   // 树身浪漫粉紫
      treeSecondary: '#fff0d6', // 碎钻香槟高光
      treeDeep: '#5b375e',      // 树身内部深莓紫（增强立体层次）
      ribbonColor: '#ffd97d',   // 螺旋星光金带
      topperColor: '#ff6ba9',   // 树顶发光爱心粉
      vortexColor: '#a6ccf5',   // 底部星河雾蓝光晕
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
      treePrimary: '#24a869',
      treeSecondary: '#ffe8a3',
      treeDeep: '#0c452b',
      ribbonColor: '#ffd059',
      topperColor: '#ffe066',
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
      treePrimary: '#5ab6ff',
      treeSecondary: '#f0f9ff',
      treeDeep: '#1a4275',
      ribbonColor: '#c4ecff',
      topperColor: '#8ae2ff',
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
      treePrimary: '#e5b55e',
      treeSecondary: '#fff8e3',
      treeDeep: '#6b4618',
      ribbonColor: '#fff0b5',
      topperColor: '#ffe073',
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
      treePrimary: '#9e73ff',
      treeSecondary: '#abfff0',
      treeDeep: '#351b6e',
      ribbonColor: '#73ffea',
      topperColor: '#d991ff',
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
      bloomStrength: 0.72
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
