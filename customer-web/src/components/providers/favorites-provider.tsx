"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type FavoritesContextValue = {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const KEY = "nausheen_favorites";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      setFavorites(JSON.parse(raw) as string[]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(KEY, JSON.stringify(favorites));
  }, [favorites]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isFavorite: (id) => favorites.includes(id),
      toggleFavorite: (id) =>
        setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
    }),
    [favorites]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
}
