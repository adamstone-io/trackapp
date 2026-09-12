import timerFinishedUrl from "../assets/sounds/timer-finished.mp3";

/** R2b: audible cue when a countdown timer reaches zero. */
export function playTimerFinishedSound() {
  const audio = new Audio(timerFinishedUrl);
  audio.volume = 0.9;
  // play() rejects if the browser blocks autoplay before any user interaction.
  audio.play()?.catch(() => {});
}
