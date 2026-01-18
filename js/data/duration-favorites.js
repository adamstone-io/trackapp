// data/duration-favorites.js

import { loadFavorites, addFavorite, removeFavorite } from "./favorites-storage.js";

const TYPE = "duration";

/**
 * Duration-specific helpers (convenience layer)
 */
export function loadDurationFavorites() {
  return loadFavorites(TYPE);
}

export function addDurationFavorite(label, seconds) {
  return addFavorite(TYPE, label, { seconds });
}

export function removeDurationFavorite(id) {
  return removeFavorite(TYPE, id);
}

/**
 * Get duration in seconds from favorite
 */
export function getDurationSeconds(favorite) {
  return favorite.data.seconds;
}
