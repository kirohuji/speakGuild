export interface FavoriteItem {
  id: string;
  questionId: string;
  topicName: string;
  questionText: string;
  createdAt: string;
}

// Stub: old favorites system removed
export async function getFavorites(): Promise<FavoriteItem[]> {
  return [];
}
