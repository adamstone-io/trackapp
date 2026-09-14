/**
 * Countdown duration favorites, kept in localStorage under the same key and
 * shape as the legacy frontend (tempotrack_favorites_duration) so a user's
 * existing favorites carry over.
 */

export interface DurationFavorite {
  id: number;
  type: "duration";
  label: string;
  data: { seconds: number };
  createdAt?: string;
  order: number;
}

const STORAGE_KEY = "tempotrack_favorites_duration";

const STARTER_MINUTES = [20, 50, 1];

function starters(): DurationFavorite[] {
  return STARTER_MINUTES.map((minutes, index) => ({
    id: index + 1,
    type: "duration",
    label: `${minutes} min`,
    data: { seconds: minutes * 60 },
    order: index,
  }));
}

export function loadDurationFavorites(): DurationFavorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DurationFavorite[]) : starters();
  } catch {
    return starters();
  }
}

function save(favorites: DurationFavorite[]): DurationFavorite[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  return favorites;
}

/** No-op (returns the current list) when the duration is already a favorite. */
export function addDurationFavorite(minutes: number): DurationFavorite[] {
  const favorites = loadDurationFavorites();
  const seconds = minutes * 60;
  if (favorites.some((favorite) => favorite.data.seconds === seconds)) return favorites;
  return save([
    ...favorites,
    {
      id: Date.now(),
      type: "duration",
      label: `${minutes} min`,
      data: { seconds },
      createdAt: new Date().toISOString(),
      order: favorites.length,
    },
  ]);
}

export function removeDurationFavorite(id: number): DurationFavorite[] {
  return save(loadDurationFavorites().filter((favorite) => favorite.id !== id));
}

/** Drop the favorites on logout: they belong to the account that is leaving. */
export function clearDurationFavorites(): void {
  localStorage.removeItem(STORAGE_KEY);
}
