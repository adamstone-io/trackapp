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
      targetDuration: 0,  // in seconds
      selectedFavoriteId: null,
    };
  
    // DOM elements
    const elements = {
      modeStopwatch: document.getElementById("mode-stopwatch-btn"),
      modeCountdown: document.getElementById("mode-countdown-btn"),
      countdownSection: document.getElementById("countdown-section"),
      favoritesList: document.getElementById("favorites-list"),
      addFavoriteBtn: document.getElementById("add-favorite-btn"),
      clock: document.getElementById("timer-clock"),
    };
  
    // Event listener references (for cleanup)
    const listeners = [];
  
    // Initialize
    init();
  
    function init() {
      bindEvents();
      renderFavorites();
      elements.clock.contentEditable = "false";
    }
  
    /**
     * Bind all event listeners
     */
    function bindEvents() {
      addListener(elements.modeStopwatch, "click", () => setMode("stopwatch"));
      addListener(elements.modeCountdown, "click", () => setMode("countdown"));

      addListener(elements.addFavoriteBtn, "click", handleAddFavorite);
      addListener(elements.clock, "focus", handleClockFocus);
      addListener(elements.clock, "keydown", handleClockKeydown);
      addListener(elements.clock, "blur", handleClockBlur);
    }
  
    /**
     * Add event listener and track for cleanup
     */
    function addListener(element, event, handler) {
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
      elements.modeStopwatch.classList.toggle("mode-btn--active", !isCountdown);
      elements.modeCountdown.classList.toggle("mode-btn--active", isCountdown);
      elements.countdownSection.classList.toggle("hidden", !isCountdown);
      elements.clock.contentEditable = isCountdown ? "true" : "false";
      elements.clock.classList.toggle("timer__clock--editable", isCountdown);
      if (!isCountdown) {
        elements.clock.textContent = formatTime(0);
      }
      
      // Dispatch event for timer controller
      document.dispatchEvent(new CustomEvent("timer:modeChange", { 
        detail: { 
          mode,
          targetDuration: state.targetDuration
        } 
      }));
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
        .map(fav => createFavoriteChipHTML(fav))
        .join("");
      
      // Bind click events to favorites
      favorites.forEach(fav => {
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
  
    function handleClockKeydown(event) {
      if (state.mode !== "countdown") return;
      if (event.key === "Enter") {
        event.preventDefault();
        elements.clock.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        elements.clock.textContent = formatTime(state.targetDuration);
        elements.clock.blur();
      }
    }

    function handleClockBlur() {
      if (state.mode !== "countdown") return;
      const input = elements.clock.textContent;
      const parsed = parseDurationInput(input);
      if (parsed === null) {
        elements.clock.textContent = formatTime(state.targetDuration);
        return;
      }

      state.targetDuration = parsed;
      state.selectedFavoriteId = null;
      updateFavoritesSelection();
      elements.clock.textContent = formatTime(state.targetDuration);

      document.dispatchEvent(
        new CustomEvent("countdown:durationChange", {
          detail: { duration: state.targetDuration },
        }),
      );
    }

    function handleClockFocus() {
      if (state.mode !== "countdown") return;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(elements.clock);
      selection.removeAllRanges();
      selection.addRange(range);
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
          class="favorite-chip ${isSelected ? 'favorite-chip--selected' : ''}"
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
      
      // Update UI
      updateFavoritesSelection();
      
      // Notify timer controller
      if (state.mode === "countdown") {
        document.dispatchEvent(new CustomEvent("countdown:durationChange", {
          detail: { duration: state.targetDuration }
        }));
      }
    }
  
    /**
     * Update visual selection of favorites
     */
    function updateFavoritesSelection() {
      document.querySelectorAll(".favorite-chip").forEach(chip => {
        const id = parseInt(chip.id.replace("favorite-", ""));
        chip.classList.toggle("favorite-chip--selected", id === state.selectedFavoriteId);
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

    function parseDurationInput(value) {
      const trimmed = String(value || "").trim();
      if (!trimmed) return null;
      const parts = trimmed.split(":").map((part) => part.trim());
      if (parts.some((part) => part === "")) return null;
      const nums = parts.map((part) => Number(part));
      if (nums.some((num) => Number.isNaN(num) || num < 0)) return null;

      if (nums.length === 3) {
        const [hours, minutes, seconds] = nums;
        return Math.floor(hours * 3600 + minutes * 60 + seconds);
      }
      if (nums.length === 2) {
        const [minutes, seconds] = nums;
        return Math.floor(minutes * 60 + seconds);
      }
      if (nums.length === 1) {
        return Math.floor(nums[0]);
      }
      return null;
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
  