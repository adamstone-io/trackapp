// data/favorites-storage.js

/**
 * Generic favorites storage system.
 * Supports multiple favorite types (durations, tasks, categories, etc.)
 */

const STORAGE_PREFIX = "tempotrack_favorites_";

/**
 * Favorite structure:
 * {
 *   id: number,
 *   type: string,      // "duration", "task", "category", etc.
 *   label: string,
 *   data: any,         // Type-specific data
 *   createdAt: string,
 *   order: number      // For custom ordering
 * }
 */

/**
 * Load favorites of a specific type
 */
export function loadFavorites(type) {
  try {
    const key = STORAGE_PREFIX + type;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : getDefaults(type);
  } catch (error) {
    console.error(`Failed to load favorites (${type}):`, error);
    return getDefaults(type);
  }
}

/**
 * Save favorites of a specific type
 */
export function saveFavorites(type, favorites) {
  try {
    const key = STORAGE_PREFIX + type;
    localStorage.setItem(key, JSON.stringify(favorites));
  } catch (error) {
    console.error(`Failed to save favorites (${type}):`, error);
  }
}

/**
 * Add a new favorite
 */
export function addFavorite(type, label, data) {
  const favorites = loadFavorites(type);
  const newFavorite = {
    id: Date.now(),
    type,
    label,
    data,
    createdAt: new Date().toISOString(),
    order: favorites.length,
  };
  favorites.push(newFavorite);
  saveFavorites(type, favorites);
  return newFavorite;
}

/**
 * Remove a favorite by ID
 */
export function removeFavorite(type, id) {
  const favorites = loadFavorites(type);
  const filtered = favorites.filter((fav) => fav.id !== id);
  saveFavorites(type, filtered);
}

/**
 * Update a favorite
 */
export function updateFavorite(type, id, updates) {
  const favorites = loadFavorites(type);
  const index = favorites.findIndex((fav) => fav.id === id);
  if (index !== -1) {
    favorites[index] = { ...favorites[index], ...updates };
    saveFavorites(type, favorites);
    return favorites[index];
  }
  return null;
}

/**
 * Reorder favorites
 */
export function reorderFavorites(type, favoriteIds) {
  const favorites = loadFavorites(type);
  favoriteIds.forEach((id, index) => {
    const favorite = favorites.find((f) => f.id === id);
    if (favorite) favorite.order = index;
  });
  favorites.sort((a, b) => a.order - b.order);
  saveFavorites(type, favorites);
}

/**
 * Get default favorites for a type
 */
function getDefaults(type) {
  const defaults = {
    duration: [
      { id: 1, type: "duration", label: "Pomodoro", data: { seconds: 1500 }, order: 0 },
      { id: 2, type: "duration", label: "Short Break", data: { seconds: 300 }, order: 1 },
      { id: 3, type: "duration", label: "Long Break", data: { seconds: 900 }, order: 2 },
      { id: 4, type: "duration", label: "Deep Work", data: { seconds: 5400 }, order: 3 },
    ],
    task: [
      { id: 101, type: "task", label: "Code Review", data: { category: "Work" }, order: 0 },
      { id: 102, type: "task", label: "Email", data: { category: "Work" }, order: 1 },
      { id: 103, type: "task", label: "Exercise", data: { category: "Health" }, order: 2 },
    ],
    category: [
      { id: 201, type: "category", label: "Work", data: { color: "#3b82f6" }, order: 0 },
      { id: 202, type: "category", label: "Personal", data: { color: "#10b981" }, order: 1 },
      { id: 203, type: "category", label: "Learning", data: { color: "#8b5cf6" }, order: 2 },
    ]
  };
  
  return defaults[type] || [];
}

/**
 * Search favorites across types
 */
export function searchFavorites(query, types = null) {
  const typesToSearch = types || ["duration", "task", "category"];
  const results = [];
  
  typesToSearch.forEach(type => {
    const favorites = loadFavorites(type);
    const matches = favorites.filter(fav => 
      fav.label.toLowerCase().includes(query.toLowerCase())
    );
    results.push(...matches);
  });
  
  return results;
}
