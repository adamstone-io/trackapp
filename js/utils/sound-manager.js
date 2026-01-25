const sounds = new Map();
let enabled = true;

function register(name, url, { volume = 1, preload = "auto" } = {}) {
  const audio = new Audio(url);
  audio.preload = preload;
  audio.volume = volume;
  sounds.set(name, audio);
}

function play(name, { restart = true } = {}) {
  if (!enabled) return;
  const audio = sounds.get(name);
  if (!audio) return;
  if (restart) {
    audio.currentTime = 0;
  }
  audio.play().catch(() => {
    // Autoplay can be blocked until user interaction.
  });
}

function setEnabled(value) {
  enabled = Boolean(value);
}

export const SoundManager = {
  register,
  play,
  setEnabled,
};
