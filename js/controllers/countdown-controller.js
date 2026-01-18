// controllers/countdown-controller.js

import { 
    loadDurationFavorites, 
    addDurationFavorite, 
    removeDurationFavorite, 
    getDurationSeconds 
  } from "../data/duration-favorites.js";
  
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
      hoursInput: document.getElementById("hours-input"),
      minutesInput: document.getElementById("minutes-input"),
      secondsInput: document.getElementById("seconds-input"),
      favoritesList: document.getElementById("favorites-list"),
      addFavoriteBtn: document.getElementById("add-favorite-btn"),
    };
  
    // Event listener references (for cleanup)
    const listeners = [];
  
    // Initialize
    init();
  
    function init() {
      bindEvents();
      renderFavorites();
      updateTargetDuration(); // Set initial duration from inputs
    }
  
    /**
     * Bind all event listeners
     */
    function bindEvents() {
      addListener(elements.modeStopwatch, "click", () => setMode("stopwatch"));
      addListener(elements.modeCountdown, "click", () => setMode("countdown"));
      
      addListener(elements.hoursInput, "input", updateTargetDuration);
      addListener(elements.minutesInput, "input", updateTargetDuration);
      addListener(elements.secondsInput, "input", updateTargetDuration);
      
      addListener(elements.addFavoriteBtn, "click", handleAddFavorite);
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
    function updateTargetDuration() {
      const hours = parseInt(elements.hoursInput.value) || 0;
      const minutes = parseInt(elements.minutesInput.value) || 0;
      const seconds = parseInt(elements.secondsInput.value) || 0;
      
      state.targetDuration = (hours * 3600) + (minutes * 60) + seconds;
      state.selectedFavoriteId = null; // Clear selection when manual input
      
      // Update favorites selection UI
      updateFavoritesSelection();
      
      // Notify timer controller of duration change
      if (state.mode === "countdown") {
        document.dispatchEvent(new CustomEvent("countdown:durationChange", {
          detail: { duration: state.targetDuration }
        }));
      }
    }
  
    /**
     * Render all favorite durations
     */
    function renderFavorites() {
      const favorites = loadDurationFavorites();
      
      if (favorites.length === 0) {
        elements.favoritesList.innerHTML = `
          <div class="favorites-empty">
            No favorites yet. Set a duration and click "⭐ Save Favorite"
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
      
      // Update input fields
      const { hours, minutes, secs } = secondsToHMS(seconds);
      elements.hoursInput.value = hours;
      elements.minutesInput.value = minutes;
      elements.secondsInput.value = secs;
      
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
  