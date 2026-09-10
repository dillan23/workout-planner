/**
 * Generates the placeholder audio the game ships with.
 *
 * These are synthesised on purpose rather than sourced: they are the right
 * length, the right shape and unambiguously temporary, so replacing them is a
 * matter of dropping real files over the top with the same names. See the
 * "Replacing the sounds" section of the README.
 *
 * Run with: npm run sounds
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'audio');

function writeWav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.concat([header, data]));
  console.log(name.padEnd(20), (data.length / 1024).toFixed(0) + ' KB',
    (samples.length / RATE).toFixed(2) + ' s');
}

/**
 * Ambient: a slow underwater drone.
 *
 * Every partial completes a whole number of cycles across the loop, so the end
 * meets the start exactly and it repeats without a seam.
 */
function ambient() {
  const seconds = 6;
  const n = RATE * seconds;
  const out = new Float32Array(n);
  const partials = [
    { cycles: 3 * seconds, gain: 0.22 },
    { cycles: 5 * seconds, gain: 0.11 },
    { cycles: 8 * seconds, gain: 0.07 },
    { cycles: 12 * seconds, gain: 0.04 },
  ];
  for (let i = 0; i < n; i++) {
    const phase = i / n;
    let v = 0;
    for (const p of partials) {
      v += Math.sin(2 * Math.PI * p.cycles * phase) * p.gain;
    }
    // One slow swell per loop, also seamless.
    v *= 0.75 + 0.25 * Math.sin(2 * Math.PI * phase);
    out[i] = v;
  }
  return out;
}

/** Bite: a short wet blip, pitch falling fast, with a splash of noise. */
function bite() {
  const seconds = 0.16;
  const n = Math.round(RATE * seconds);
  const out = new Float32Array(n);
  let phase = 0;
  let noiseSeed = 12345;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 420 * Math.pow(0.35, t); // drops about an octave and a half
    phase += (2 * Math.PI * freq) / RATE;
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    const noise = (noiseSeed / 4294967296) * 2 - 1;
    const envelope = Math.pow(1 - t, 2.2);
    out[i] = (Math.sin(phase) * 0.8 + noise * 0.2) * envelope * 0.7;
  }
  return out;
}

/** Death: a low thud with a short knock on the front. */
function death() {
  const seconds = 0.7;
  const n = Math.round(RATE * seconds);
  const out = new Float32Array(n);
  let phase = 0;
  let noiseSeed = 987654321;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 110 * Math.pow(0.55, t);
    phase += (2 * Math.PI * freq) / RATE;
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    const noise = (noiseSeed / 4294967296) * 2 - 1;
    const knock = Math.pow(Math.max(0, 1 - t * 22), 3) * 0.35;
    const body = Math.sin(phase) * Math.pow(1 - t, 1.6) * 0.85;
    out[i] = body + noise * knock;
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
writeWav('ambient-loop.wav', ambient());
writeWav('bite.wav', bite());
writeWav('death.wav', death());
