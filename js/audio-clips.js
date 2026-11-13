export const CRY_SECONDS = 1.8;
export const ATTACK_SECONDS = 1.5;
export const SOUND_BUCKET = "nativa-sounds";

// Mono PCM makes these short clips portable, small and independently playable.
export function wavMono(samples, sampleRate) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true));
  return new Blob([bytes], { type: "audio/wav" });
}

export function shortClip(buffer, seconds) {
  if (!buffer?.length || !buffer.numberOfChannels || buffer.duration > 120)
    throw new Error("Escolha uma gravação com até 2 minutos.");
  const rate = 24000;
  const mono = new Float32Array(Math.round(buffer.duration * rate));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++)
      mono[i] +=
        (channel[Math.min(channel.length - 1, Math.floor((i * buffer.sampleRate) / rate))] || 0) /
        buffer.numberOfChannels;
  }
  // Locate the first audible onset, rather than keeping leading silence.
  let peak = 0;
  for (const value of mono) peak = Math.max(peak, Math.abs(value));
  if (peak < 0.0001) throw new Error("A gravação está silenciosa. Escolha outro som.");
  let onset = mono.findIndex(value => Math.abs(value) > peak * 0.12);
  onset = Math.max(0, onset - Math.round(rate * 0.03));
  const length = Math.round(rate * Math.min(2, Math.max(1.5, seconds)));
  const output = new Float32Array(length);
  const gain = Math.min(4, 0.8 / peak),
    fade = Math.round(rate * 0.04);
  for (let i = 0; i < length; i++) {
    output[i] = (mono[onset + i] || 0) * gain * Math.min(1, i / fade, (length - 1 - i) / fade);
  }
  return wavMono(output, rate);
}

export function fallbackVoice(nativa) {
  const label = `${nativa.groupBio || ""} ${nativa.lineageName || nativa.lineage || ""} ${nativa.species || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/ave|coruja|passaro|psitaci|rapina/.test(label)) return "bird";
  if (/anuro|anfib|sapo|\bra\b/.test(label)) return "amphibian";
  if (/inseto|aracni|crustace|artrop/.test(label)) return "insect";
  if (/peixe|siluriform|characiform|cartilagin/.test(label)) return "aquatic";
  if (/rept|serpente|lagarto|quelonio|crocodil/.test(label)) return "reptile";
  return "mammal";
}
