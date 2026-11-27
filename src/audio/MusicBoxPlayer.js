/**
 * 零外部素材 Web Audio 晶体八音盒圣诞音乐合成器
 * --------------------------------------------------
 * 1. 内置 3 首经典圣诞旋律（祝你圣诞快乐 / 铃儿响叮当 / 平安夜），循环流畅播放；
 * 2. 自带点亮仪式上升琶音（playIgniteChime）与烟花轻柔星尘音效（playFireworkChime）；
 * 3. 输出实时精准节拍能量（0..1），驱动圣诞树碎钻、丝带、树顶爱心与星河底座随音符节奏律动。
 */

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 旋律格式：[主音 MIDI（null 为休止符）, 拍数, 伴奏低音 MIDI（可为 null）, 节拍重音强度]
const TRACKS = {
  'we-wish': {
    bpm: 116,
    notes: [
      // We wish you a Merry Christmas
      [67, 1, 48, 0.72],
      [72, 1, 48, 1.0],
      [72, 0.5, null, 0.55],
      [74, 0.5, null, 0.6],
      [72, 0.5, null, 0.55],
      [71, 0.5, null, 0.55],
      [69, 1, 53, 0.85],
      [69, 1, 57, 0.65],

      // We wish you a Merry Christmas
      [69, 1, 53, 0.72],
      [74, 1, 50, 1.0],
      [74, 0.5, null, 0.55],
      [76, 0.5, null, 0.6],
      [74, 0.5, null, 0.55],
      [72, 0.5, null, 0.55],
      [71, 1, 55, 0.85],
      [67, 1, 55, 0.65],

      // We wish you a Merry Christmas
      [67, 1, 48, 0.72],
      [76, 1, 52, 1.0],
      [76, 0.5, null, 0.55],
      [77, 0.5, null, 0.6],
      [76, 0.5, null, 0.55],
      [74, 0.5, null, 0.55],
      [72, 1, 57, 0.85],
      [69, 1, 53, 0.65],

      // And a Happy New Year
      [67, 0.5, 48, 0.65],
      [67, 0.5, null, 0.5],
      [69, 1, 53, 0.9],
      [74, 1, 55, 0.85],
      [71, 1, 55, 0.8],
      [72, 2, 48, 1.0],

      // Good tidings we bring to you and your kin
      [67, 1, 48, 0.7],
      [72, 1, 48, 0.95],
      [72, 1, 55, 0.75],
      [72, 1, 52, 0.78],
      [71, 2, 55, 0.9],
      [71, 1, 55, 0.68],
      [72, 1, 57, 0.92],
      [71, 1, 55, 0.75],
      [69, 1, 53, 0.75],
      [67, 2, 48, 0.9],

      // Good tidings for Christmas and a Happy New Year
      [74, 1, 50, 0.75],
      [76, 1, 52, 0.95],
      [74, 1, 55, 0.75],
      [72, 1, 48, 0.8],
      [79, 1, 55, 0.95],
      [67, 1, 43, 0.7],
      [67, 0.5, 48, 0.65],
      [67, 0.5, null, 0.5],
      [69, 1, 53, 0.9],
      [74, 1, 55, 0.85],
      [71, 1, 55, 0.8],
      [72, 2.5, 48, 1.0]
    ]
  },

  'jingle-bells': {
    bpm: 126,
    notes: [
      // Jingle bells, jingle bells, jingle all the way
      [76, 1, 48, 1.0],
      [76, 1, 55, 0.72],
      [76, 2, 52, 0.92],

      [76, 1, 48, 1.0],
      [76, 1, 55, 0.72],
      [76, 2, 52, 0.92],

      [76, 1, 48, 1.0],
      [79, 1, 55, 0.88],
      [72, 1.5, 52, 0.95],
      [74, 0.5, null, 0.6],
      [76, 4, 48, 1.0],

      // Oh what fun it is to ride in a one-horse open sleigh
      [77, 1, 53, 1.0],
      [77, 1, 57, 0.74],
      [77, 1.5, 53, 0.88],
      [77, 0.5, null, 0.58],

      [77, 1, 48, 0.92],
      [76, 1, 52, 0.75],
      [76, 1, 55, 0.78],
      [76, 0.5, null, 0.55],
      [76, 0.5, null, 0.55],

      [76, 1, 50, 0.92],
      [74, 1, 57, 0.78],
      [74, 1, 54, 0.78],
      [76, 1, 50, 0.82],
      [74, 2, 55, 0.92],
      [79, 2, 55, 0.9],

      // Second chorus ending: one-horse open sleigh!
      [76, 1, 48, 1.0],
      [76, 1, 55, 0.72],
      [76, 2, 52, 0.92],

      [76, 1, 48, 1.0],
      [76, 1, 55, 0.72],
      [76, 2, 52, 0.92],

      [76, 1, 48, 1.0],
      [79, 1, 55, 0.88],
      [72, 1.5, 52, 0.95],
      [74, 0.5, null, 0.6],
      [76, 4, 48, 1.0],

      [77, 1, 53, 1.0],
      [77, 1, 57, 0.74],
      [77, 1.5, 53, 0.88],
      [77, 0.5, null, 0.58],

      [77, 1, 48, 0.92],
      [76, 1, 52, 0.75],
      [76, 1, 55, 0.78],
      [76, 0.5, null, 0.55],
      [76, 0.5, null, 0.55],

      [79, 1, 55, 0.98],
      [79, 1, 59, 0.82],
      [77, 1, 55, 0.85],
      [74, 1, 50, 0.82],
      [72, 4, 48, 1.0]
    ]
  },

  'silent-night': {
    bpm: 86,
    notes: [
      // Silent night, holy night
      [79, 1.5, 48, 1.0],
      [81, 0.5, 55, 0.62],
      [79, 1, 52, 0.75],
      [76, 3, 48, 0.92],

      [79, 1.5, 48, 1.0],
      [81, 0.5, 55, 0.62],
      [79, 1, 52, 0.75],
      [76, 3, 48, 0.92],

      // All is calm, all is bright
      [86, 2, 55, 1.0],
      [86, 1, 59, 0.75],
      [83, 3, 55, 0.92],

      [84, 2, 48, 1.0],
      [84, 1, 55, 0.75],
      [79, 3, 52, 0.9],

      // Round yon virgin, mother and child
      [81, 2, 53, 1.0],
      [81, 1, 57, 0.74],
      [84, 1.5, 53, 0.9],
      [83, 0.5, null, 0.6],
      [81, 1, 57, 0.74],
      [79, 1.5, 48, 0.92],
      [81, 0.5, 55, 0.62],
      [79, 1, 52, 0.75],
      [76, 3, 48, 0.88],

      [81, 2, 53, 1.0],
      [81, 1, 57, 0.74],
      [84, 1.5, 53, 0.9],
      [83, 0.5, null, 0.6],
      [81, 1, 57, 0.74],
      [79, 1.5, 48, 0.92],
      [81, 0.5, 55, 0.62],
      [79, 1, 52, 0.75],
      [76, 3, 48, 0.88],

      // Sleep in heavenly peace
      [86, 2, 55, 1.0],
      [86, 1, 59, 0.76],
      [89, 1.5, 55, 0.95],
      [86, 0.5, null, 0.6],
      [83, 1, 59, 0.76],
      [84, 3, 48, 1.0],
      [88, 3, 52, 0.9],

      // Sleep in heavenly peace
      [84, 1.5, 48, 0.95],
      [79, 0.5, 55, 0.62],
      [76, 1, 52, 0.76],
      [79, 1.5, 55, 0.92],
      [77, 0.5, 53, 0.62],
      [74, 1, 50, 0.75],
      [72, 4.5, 48, 1.0]
    ]
  }
};

export class MusicBoxPlayer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filterNode = null;
    this.reverbSend = null;

    this.playing = false;
    this.trackId = 'we-wish';
    this.noteIndex = 0;
    this.nextNoteTime = 0;
    this.schedulerTimer = null;

    this.pendingBeats = [];
    this.beatEnvelope = 0;
    this.smoothBeat = 0;
  }

  /**
   * 在用户点击手势内同步解锁 / 创建 Web Audio 上下文（兼容 iOS Safari 与微信内置浏览器）
   */
  unlock() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this._buildAudioGraph();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  _buildAudioGraph() {
    const ctx = this.ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.42;

    // 柔和低通滤波，让八音盒高频清亮却绝不刺耳
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 5200;
    this.filterNode.Q.value = 0.6;

    this.masterGain.connect(this.filterNode);
    this.filterNode.connect(ctx.destination);

    // 双延迟立体声空间混响总线（模拟水晶八音盒共鸣箱）
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.26;

    const delayL = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.19;
    const delayR = ctx.createDelay(1.0);
    delayR.delayTime.value = 0.31;

    const fbL = ctx.createGain();
    fbL.gain.value = 0.24;
    const fbR = ctx.createGain();
    fbR.gain.value = 0.22;

    const wetFilter = ctx.createBiquadFilter();
    wetFilter.type = 'lowpass';
    wetFilter.frequency.value = 2600;

    this.reverbSend.connect(delayL);
    this.reverbSend.connect(delayR);

    delayL.connect(fbL);
    fbL.connect(delayR);

    delayR.connect(fbR);
    fbR.connect(delayL);

    delayL.connect(wetFilter);
    delayR.connect(wetFilter);
    wetFilter.connect(this.masterGain);
  }

  _playNote(midi, startTime, duration, velocity = 0.7, isBass = false) {
    if (!this.ctx || !this.masterGain || midi == null) return;
    const ctx = this.ctx;
    const freq = midiToFreq(midi);
    const tail = Math.max(0.7, duration * 1.45);
    const peak = isBass ? 0.14 * velocity : 0.28 * velocity;

    // 1. 温暖基频正弦波
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + tail);

    osc.connect(gain);
    gain.connect(this.masterGain);
    gain.connect(this.reverbSend);

    osc.start(startTime);
    osc.stop(startTime + tail + 0.04);

    // 2. 非低音部叠加金属音梳泛音，还原八音盒拨片晶莹质感
    if (!isBass) {
      const overtone2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      overtone2.type = 'triangle';
      overtone2.frequency.setValueAtTime(freq * 2, startTime);
      gain2.gain.setValueAtTime(0.0001, startTime);
      gain2.gain.linearRampToValueAtTime(0.16 * velocity, startTime + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);
      overtone2.connect(gain2);
      gain2.connect(this.masterGain);
      overtone2.start(startTime);
      overtone2.stop(startTime + 0.25);

      const overtone3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      overtone3.type = 'sine';
      overtone3.frequency.setValueAtTime(freq * 3, startTime);
      gain3.gain.setValueAtTime(0.0001, startTime);
      gain3.gain.linearRampToValueAtTime(0.05 * velocity, startTime + 0.004);
      gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);
      overtone3.connect(gain3);
      gain3.connect(this.masterGain);
      overtone3.start(startTime);
      overtone3.stop(startTime + 0.15);
    }
  }

  _scheduleLoop() {
    if (!this.playing || !this.ctx) return;

    const track = TRACKS[this.trackId] || TRACKS['we-wish'];
    const secPerBeat = 60 / track.bpm;
    const lookahead = 0.22;

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const [melodyMidi, beats, bassMidi, accent = 0.72] = track.notes[this.noteIndex];
      const dur = beats * secPerBeat;

      if (melodyMidi != null) {
        this._playNote(melodyMidi, this.nextNoteTime, dur, accent, false);
        this.pendingBeats.push({
          time: this.nextNoteTime,
          strength: Math.min(1.0, Math.max(0.45, accent))
        });
      }

      if (bassMidi != null) {
        this._playNote(bassMidi, this.nextNoteTime, dur * 1.15, 0.65, true);
        if (melodyMidi == null) {
          this.pendingBeats.push({ time: this.nextNoteTime, strength: 0.32 });
        }
      }

      this.nextNoteTime += dur;
      this.noteIndex = (this.noteIndex + 1) % track.notes.length;
    }
  }

  start(trackId = this.trackId, startDelaySec = 0) {
    if (!this.unlock() || !this.ctx) return false;
    this.trackId = TRACKS[trackId] ? trackId : 'we-wish';

    this._clearScheduler();
    this.playing = true;
    this.noteIndex = 0;
    this.pendingBeats = [];
    this.nextNoteTime = this.ctx.currentTime + Math.max(0.03, startDelaySec);

    this._scheduleLoop();
    this.schedulerTimer = setInterval(() => this._scheduleLoop(), 60);
    return true;
  }

  stop() {
    this.playing = false;
    this._clearScheduler();
    this.pendingBeats = [];
  }

  _clearScheduler() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  setTrack(trackId) {
    const valid = TRACKS[trackId] ? trackId : 'we-wish';
    if (valid === this.trackId && this.playing) return;
    this.trackId = valid;
    if (this.playing) {
      this.start(valid, 0.06);
    }
  }

  isPlaying() {
    return this.playing;
  }

  /**
   * 点亮仪式上升晶体八音盒琶音
   */
  playIgniteChime() {
    if (!this.unlock() || !this.ctx) return;
    const notes = [72, 76, 79, 83, 84, 88, 91];
    const baseTime = this.ctx.currentTime + 0.02;
    notes.forEach((midi, idx) => {
      const t = baseTime + idx * 0.085;
      const strength = 0.55 + idx * 0.065;
      this._playNote(midi, t, 0.85, strength, false);
      this.pendingBeats.push({ time: t, strength: Math.min(1.0, strength) });
    });
  }

  /**
   * 烟花绽放时的轻柔星尘仙女棒音效
   */
  playFireworkChime() {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const sparkleNotes = [88 + Math.floor(Math.random() * 5), 95 + Math.floor(Math.random() * 4)];
    sparkleNotes.forEach((midi, idx) => {
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(midi), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g);
      g.connect(this.reverbSend);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
    this.pendingBeats.push({ time: now, strength: 0.72 });
  }

  /**
   * 每帧更新并输出平滑的实时节拍能量 [0, 1]，用于驱动灯光闪烁
   */
  update(delta) {
    if (this.ctx && this.ctx.state === 'running' && this.pendingBeats.length > 0) {
      const now = this.ctx.currentTime;
      let writeIdx = 0;
      for (let i = 0; i < this.pendingBeats.length; i += 1) {
        const item = this.pendingBeats[i];
        if (now >= item.time) {
          this.beatEnvelope = Math.max(this.beatEnvelope, item.strength);
        } else {
          this.pendingBeats[writeIdx] = item;
          writeIdx += 1;
        }
      }
      this.pendingBeats.length = writeIdx;
    }

    this.beatEnvelope *= Math.exp(-delta * 6.2);
    this.smoothBeat += (this.beatEnvelope - this.smoothBeat) * Math.min(1, delta * 18);

    if (this.smoothBeat < 0.002 && this.beatEnvelope < 0.002) {
      this.beatEnvelope = 0;
      this.smoothBeat = 0;
    }
    return this.smoothBeat;
  }

  handleVisibilityChange(hidden) {
    if (!this.ctx) return;
    if (hidden) {
      if (this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else if (this.playing) {
      this.ctx.resume().then(() => {
        if (this.ctx && this.nextNoteTime < this.ctx.currentTime) {
          this.nextNoteTime = this.ctx.currentTime + 0.05;
        }
      }).catch(() => {});
    }
  }
}
