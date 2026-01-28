// controllers/countdown-controller.js

import {
  loadDurationFavorites,
  addDurationFavorite,
  removeDurationFavorite,
  getDurationSeconds,
} from "../data/duration-favorites.js";
import { formatTime } from "../utils/time.js";

export function createCountdownController() {
  // State
  let state = {
    mode: "stopwatch", // "stopwatch" or "countdown"
    targetDuration: 0, // in seconds
    selectedFavoriteId: null,
  };

  // DOM elements
  const elements = {
    modeCountdown: document.getElementById("mode-countdown-btn"),
    countdownSection: document.getElementById("countdown-section"),
    favoritesList: document.getElementById("favorites-list"),
    addFavoriteBtn: document.getElementById("add-favorite-btn"),
    clock: document.getElementById("timer-clock"),
    clockDisplay: document.getElementById("timer-clock-display"),
    clockEdit: document.getElementById("timer-clock-edit"),
    hoursInput: document.getElementById("timer-clock-hours"),
    minutesInput: document.getElementById("timer-clock-minutes"),
    secondsInput: document.getElementById("timer-clock-seconds"),
  };

  // Event listener references (for cleanup)
  const listeners = [];

  // Initialize
  init();

  function init() {
    bindEvents();
    renderFavorites();
    setMode(state.mode);
    updateClockInputs(state.targetDuration);
  }

  /**
   * Bind all event listeners
   */
  function bindEvents() {
    addListener(elements.modeCountdown, "click", () => {
      setMode(state.mode === "countdown" ? "stopwatch" : "countdown");
    });

    addListener(elements.addFavoriteBtn, "click", handleAddFavorite);
    addListener(elements.clock, "click", handleClockClick);
    addListener(elements.hoursInput, "keydown", handleClockKeydown);
    addListener(elements.minutesInput, "keydown", handleClockKeydown);
    addListener(elements.secondsInput, "keydown", handleClockKeydown);
    addListener(elements.hoursInput, "focus", handleClockFocus);
    addListener(elements.minutesInput, "focus", handleClockFocus);
    addListener(elements.secondsInput, "focus", handleClockFocus);
    addListener(elements.clockEdit, "click", stopClockClickPropagation);
    addListener(elements.hoursInput, "click", stopClockClickPropagation);
    addListener(elements.minutesInput, "click", stopClockClickPropagation);
    addListener(elements.secondsInput, "click", stopClockClickPropagation);
    addListener(elements.hoursInput, "blur", handleClockBlur);
    addListener(elements.minutesInput, "blur", handleClockBlur);
    addListener(elements.secondsInput, "blur", handleClockBlur);
  }

  /**
   * Add event listener and track for cleanup
   */
  function addListener(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    listeners.push({ element, event, handler });
  }

  /**
   * Set timer mode (stopwatch or countdown)
   */
  function setMode(mode) {
    state.mode = mode;

    // Update UI
    const isCountdown = mode === "countdown";
    if (elements.modeCountdown) {
      elements.modeCountdown.classList.toggle("mode-btn--active", isCountdown);
      elements.modeCountdown.setAttribute(
        "aria-pressed",
        isCountdown ? "true" : "false",
      );
    }
    if (elements.countdownSection) {
      elements.countdownSection.classList.toggle("hidden", !isCountdown);
    }
    if (elements.clock) {
      elements.clock.classList.toggle("timer__clock--editable", isCountdown);
    }
    setClockEditMode(false);
    if (!isCountdown) {
      setClockDisplay(formatTime(0));
    }

    // Dispatch event for timer controller
    document.dispatchEvent(
      new CustomEvent("timer:modeChange", {
        detail: {
          mode,
          targetDuration: state.targetDuration,
        },
      }),
    );
  }

  /**
   * Update target duration from input fields
   */
  /**
   * Render all favorite durations
   */
  function renderFavorites() {
    const favorites = loadDurationFavorites();

    if (favorites.length === 0) {
      elements.favoritesList.innerHTML = `
          <div class="favorites-empty">
            No favorites yet. Click the clock to set a duration and save it.
          </div>
        `;
      return;
    }

    elements.favoritesList.innerHTML = favorites
      .map((fav) => createFavoriteChipHTML(fav))
      .join("");

    // Bind click events to favorites
    favorites.forEach((fav) => {
      const chip = document.getElementById(`favorite-${fav.id}`);
      if (chip) {
        chip.addEventListener("click", () => selectFavorite(fav));

        const removeBtn = chip.querySelector(".favorite-chip__remove");
        if (removeBtn) {
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleRemoveFavorite(fav.id);
          });
        }
      }
    });

    if (state.targetDuration === 0 && favorites.length > 0) {
      selectFavorite(favorites[0]);
    }
  }

  function handleClockClick(event) {
    if (state.mode !== "countdown") return;

    const isEditing = !elements.clockEdit.classList.contains("hidden");
    const targetIsInput =
      event.target === elements.hoursInput ||
      event.target === elements.minutesInput ||
      event.target === elements.secondsInput;

    if (!isEditing) {
      setClockEditMode(true);
    }

    if (targetIsInput) {
      event.target.focus();
      event.target.select();
    }
  }

  function handleClockFocus(event) {
    event.target.select();
  }

  function handleClockKeydown(event) {
    if (state.mode !== "countdown") return;
    if (event.key === "Enter") {
      event.preventDefault();
      commitClockInputs();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setClockEditMode(false);
      updateClockInputs(state.targetDuration);
    }
  }

  function handleClockBlur() {
    if (state.mode !== "countdown") return;
    window.setTimeout(() => {
      if (!elements.clockEdit.contains(document.activeElement)) {
        commitClockInputs();
      }
    }, 0);
  }

  /**
   * Create HTML for a favorite chip
   */
  function createFavoriteChipHTML(favorite) {
    const isSelected = state.selectedFavoriteId === favorite.id;
    const seconds = getDurationSeconds(favorite);
    const { hours, minutes, secs } = secondsToHMS(seconds);

    // Format time label
    let timeLabel = "";
    if (hours > 0) timeLabel += `${hours}h `;
    if (minutes > 0) timeLabel += `${minutes}m `;
    if (secs > 0 && hours === 0) timeLabel += `${secs}s`;

    return `
        <div 
          id="favorite-${favorite.id}" 
          class="favorite-chip ${isSelected ? "favorite-chip--selected" : ""}"
          role="button"
          tabindex="0"
        >
          <span class="favorite-chip__time">${timeLabel.trim()}</span>
          <button 
            class="favorite-chip__remove" 
            type="button"
            title="Remove favorite"
            aria-label="Remove ${favorite.label}"
          >
            ×
          </button>
        </div>
      `;
  }

  /**
   * Select a favorite duration
   */
  function selectFavorite(favorite) {
    state.selectedFavoriteId = favorite.id;
    const seconds = getDurationSeconds(favorite);
    state.targetDuration = seconds;
    updateClockInputs(state.targetDuration);

    // Update UI
    updateFavoritesSelection();

    // Notify timer controller
    if (state.mode === "countdown") {
      document.dispatchEvent(
        new CustomEvent("countdown:durationChange", {
          detail: { duration: state.targetDuration },
        }),
      );
    }
  }

  /**
   * Update visual selection of favorites
   */
  function updateFavoritesSelection() {
    document.querySelectorAll(".favorite-chip").forEach((chip) => {
      const id = parseInt(chip.id.replace("favorite-", ""));
      chip.classList.toggle(
        "favorite-chip--selected",
        id === state.selectedFavoriteId,
      );
    });
  }

  /**
   * Handle adding a new favorite
   */
  function handleAddFavorite() {
    if (state.targetDuration === 0) {
      alert("Please set a duration first");
      return;
    }

    const label = prompt("Name this favorite duration:");
    if (!label || label.trim() === "") {
      return;
    }

    // Add to storage
    addDurationFavorite(label.trim(), state.targetDuration);

    // Re-render
    renderFavorites();
  }

  /**
   * Handle removing a favorite
   */
  function handleRemoveFavorite(id) {
    if (!confirm("Remove this favorite?")) {
      return;
    }

    removeDurationFavorite(id);

    // Clear selection if this was selected
    if (state.selectedFavoriteId === id) {
      state.selectedFavoriteId = null;
    }

    // Re-render
    renderFavorites();
  }

  /**
   * Convert seconds to hours, minutes, seconds
   */
  function secondsToHMS(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return { hours, minutes, secs };
  }

  function updateClockInputs(totalSeconds) {
    const { hours, minutes, secs } = secondsToHMS(totalSeconds);
    elements.hoursInput.value = pad2(hours);
    elements.minutesInput.value = pad2(minutes);
    elements.secondsInput.value = pad2(secs);
  }

  function setClockEditMode(isEditing) {
    elements.clockEdit.classList.toggle("hidden", !isEditing);
    elements.clockDisplay.classList.toggle("hidden", isEditing);
    elements.clock.classList.toggle("timer__clock--editing", isEditing);
  }

  function commitClockInputs() {
    const hours = parseClockNumber(elements.hoursInput.value);
    const minutes = parseClockNumber(elements.minutesInput.value);
    const seconds = parseClockNumber(elements.secondsInput.value);
    const nextDuration = Math.max(0, hours * 3600 + minutes * 60 + seconds);

    state.targetDuration = nextDuration;
    state.selectedFavoriteId = null;
    updateFavoritesSelection();
    updateClockInputs(state.targetDuration);
    setClockEditMode(false);

    document.dispatchEvent(
      new CustomEvent("countdown:durationChange", {
        detail: { duration: state.targetDuration },
      }),
    );
  }

  function stopClockClickPropagation(event) {
    event.stopPropagation();
  }

  function parseClockNumber(value) {
    const trimmed = String(value || "").replace(/\D/g, "");
    if (!trimmed) return 0;
    return Math.max(0, parseInt(trimmed, 10));
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function setClockDisplay(value) {
    const [hours = "00", minutes = "00", seconds = "00"] =
      String(value).split(":");
    const hoursDisplay = elements.clockDisplay?.querySelector(
      '[data-clock-part="hours"]',
    );
    const minutesDisplay = elements.clockDisplay?.querySelector(
      '[data-clock-part="minutes"]',
    );
    const secondsDisplay = elements.clockDisplay?.querySelector(
      '[data-clock-part="seconds"]',
    );
    if (hoursDisplay && minutesDisplay && secondsDisplay) {
      hoursDisplay.textContent = hours;
      minutesDisplay.textContent = minutes;
      secondsDisplay.textContent = seconds;
    } else if (elements.clockDisplay) {
      elements.clockDisplay.textContent = value;
    }
  }

  /**
   * Get current target duration
   */
  function getTargetDuration() {
    return state.targetDuration;
  }

  /**
   * Get current mode
   */
  function getMode() {
    return state.mode;
  }

  /**
   * Cleanup
   */
  function dispose() {
    // Remove all event listeners
    listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
  }

  // Public API
  return {
    getTargetDuration,
    getMode,
    dispose,
  };
}
