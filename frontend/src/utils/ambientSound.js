// Calming background sounds made in the browser (Web Audio), so there are no
// audio files to host or download. Noise is generated once, then shaped with
// filters and slow movement to sound like rain, waves or wind.

export const SOUNDS = [
  { key: 'rain', label: 'Rain' },
  { key: 'ocean', label: 'Ocean waves' },
  { key: 'wind', label: 'Night wind' },
  { key: 'brown', label: 'Deep calm' },
  { key: 'white', label: 'White noise' },
];

function makeNoise(ctx, kind) {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0; let last = 0;

  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === 'white') {
      data[i] = white * 0.5;
    } else if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      // pink noise (Paul Kellet's filter)
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }

  // Blend the loop point so it does not click.
  const fade = Math.floor(ctx.sampleRate * 0.1);
  for (let i = 0; i < fade; i += 1) {
    const mix = i / fade;
    data[length - fade + i] = data[length - fade + i] * (1 - mix) + data[i] * mix;
  }
  return buffer;
}

function addSlowMovement(ctx, param, rate, depth) {
  const lfo = ctx.createOscillator();
  const amount = ctx.createGain();
  lfo.frequency.value = rate;
  amount.gain.value = depth;
  lfo.connect(amount);
  amount.connect(param);
  lfo.start();
  return lfo;
}

function build(ctx, kind, output) {
  const nodes = [];
  const source = ctx.createBufferSource();
  source.loop = true;
  source.buffer = makeNoise(ctx, kind === 'rain' || kind === 'wind' ? 'pink' : kind === 'ocean' ? 'brown' : kind);
  nodes.push(source);

  if (kind === 'rain') {
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 500;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 8000;
    source.connect(high);
    high.connect(low);
    low.connect(output);
  } else if (kind === 'ocean') {
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 700;
    const swell = ctx.createGain();
    swell.gain.value = 0.55;
    source.connect(low);
    low.connect(swell);
    swell.connect(output);
    nodes.push(addSlowMovement(ctx, swell.gain, 0.09, 0.4));
  } else if (kind === 'wind') {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 420;
    band.Q.value = 0.8;
    source.connect(band);
    band.connect(output);
    nodes.push(addSlowMovement(ctx, band.frequency, 0.12, 220));
  } else if (kind === 'brown') {
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1200;
    source.connect(low);
    low.connect(output);
  } else {
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 11000;
    source.connect(low);
    low.connect(output);
  }

  source.start();
  return nodes;
}

export function createAmbientPlayer() {
  let ctx = null;
  let master = null;
  let nodes = [];
  let volume = 0.5;
  let stopTimer = null;

  const ensure = () => {
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      ctx = new Context();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    return true;
  };

  const silence = () => {
    nodes.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* ignore */ }
    });
    nodes = [];
  };

  return {
    isSupported: () => Boolean(window.AudioContext || window.webkitAudioContext),
    async play(kind) {
      if (!ensure()) return false;
      window.clearTimeout(stopTimer);
      if (ctx.state === 'suspended') await ctx.resume();
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, 0.05);
      silence();
      nodes = build(ctx, kind, master);
      master.gain.setTargetAtTime(volume, ctx.currentTime + 0.05, 0.6);
      return true;
    },
    setVolume(value) {
      volume = value;
      if (ctx && nodes.length) master.gain.setTargetAtTime(value, ctx.currentTime, 0.1);
    },
    stop(fadeSeconds = 1.2) {
      if (!ctx || !nodes.length) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, fadeSeconds / 4);
      window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(silence, fadeSeconds * 1000);
    },
    dispose() {
      window.clearTimeout(stopTimer);
      silence();
      if (ctx) ctx.close().catch(() => {});
      ctx = null;
    },
    get state() { return ctx ? ctx.state : 'none'; },
  };
}
