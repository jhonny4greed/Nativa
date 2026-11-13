export function chooseArenaTrack(mode, selected, tracks = [], random = Math.random) {
  if (!tracks.length) return null;
  if (mode === "selected") return tracks.find(track => track.id === selected) || tracks[0];
  if (mode === "random") return tracks[Math.min(tracks.length - 1, Math.max(0, Math.floor(random() * tracks.length)))];
  return tracks[0];
}
