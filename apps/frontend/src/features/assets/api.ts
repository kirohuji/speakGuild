// Favorites API — deprecated (old question-bank system removed)
// Kept as stub for profile page compatibility

export interface FavoriteItem {
  id: string;
  questionId: string;
  questionTitle: string;
  createdAt: string;
}

/** Always returns empty — old question-bank system has been removed */
export async function getFavorites(): Promise<FavoriteItem[]> {
  return [];
}
