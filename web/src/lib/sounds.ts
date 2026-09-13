import interactionLoggedUrl from "../assets/sounds/interaction-logged.mp3";
import timerFinishedUrl from "../assets/sounds/timer-finished.mp3";

function play(url: string, volume: number) {
  const audio = new Audio(url);
  audio.volume = volume;
  // play() rejects if the browser blocks autoplay before any user interaction.
  audio.play()?.catch(() => {});
}

/** R2b: audible cue when a countdown timer reaches zero. */
export function playTimerFinishedSound() {
  play(timerFinishedUrl, 0.9);
}

/** The legacy app's confirmation tone for a logged prime or study. */
export function playInteractionLoggedSound() {
  play(interactionLoggedUrl, 0.9);
}
