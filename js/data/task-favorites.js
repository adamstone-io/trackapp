// data/task-favorites.js

import { loadFavorites, addFavorite, removeFavorite } from "./favorites-storage.js";

const TYPE = "task";

export function loadTaskFavorites() {
  return loadFavorites(TYPE);
}

export function addTaskFavorite(label, category = "Other") {
  return addFavorite(TYPE, label, { category });
}

export function removeTaskFavorite(id) {
  return removeFavorite(TYPE, id);
}

export function getTaskCategory(favorite) {
  return favorite.data.category;
}
