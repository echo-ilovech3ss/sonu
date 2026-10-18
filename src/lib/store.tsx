import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { PRODUCTS, type Product } from '../../shared/catalog';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StoreSettings } from '../../shared/types';
import { fetchProducts, fetchSettings } from './api';

interface StoreContextValue {
  products: Product[];
  settings: StoreSettings;
  ready: boolean;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextProducts, nextSettings] = await Promise.all([
        fetchProducts(),
        fetchSettings(),
      ]);
      setProducts(nextProducts);
      setSettings(nextSettings);
    } catch {
      // The static catalog and copy remain usable if the API is unavailable.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ products, settings, ready, refresh }),
    [products, settings, ready, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return context;
}
