import type { Service, Review, Category, User, Favorite } from "@shared/schema";

export interface ServiceWithDetails extends Service {
  owner: User;
  category: Category;
  rating: number;
  reviewCount: number;
}

export interface ReviewWithUser extends Review {
  user: User;
}

export interface FavoriteWithService extends Favorite {
  service: ServiceWithDetails;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || response.statusText;
    } catch {
      errorMessage = errorText || response.statusText;
    }
    throw new Error(`${response.status}: ${errorMessage}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
