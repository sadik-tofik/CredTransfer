'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiCache } from '@/lib/api-cache';

const globalCache = apiCache;

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface UseApiDataOptions<T> {
  immediate?: boolean;
  cacheKey?: string;
  ttl?: number;
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  options: UseApiDataOptions<T> = {}
) {
  const { immediate = true, cacheKey, ttl = 5 * 60 * 1000 } = options;
  
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  });

  // Create a stable fetcher reference to prevent infinite loops
  const stableFetcher = useCallback(fetcher, []);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (cacheKey && !forceRefresh) {
      const cached = globalCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        setState({
          data: cached.data,
          loading: false,
          error: null,
          lastFetched: cached.timestamp,
        });
        return cached.data;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await stableFetcher();
      
      // Cache the result
      if (cacheKey) {
        globalCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl,
        });
      }
      
      setState({
        data,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      });
      
      return data;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({ ...prev, loading: false, error }));
      // Don't throw error for network requests to prevent crashes
      console.warn('API fetch failed:', error);
      return null;
    }
  }, [cacheKey, ttl, stableFetcher]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Only run effect when immediate changes, not when fetchData changes
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate]);

  return { ...state, refetch, fetchData };
}
