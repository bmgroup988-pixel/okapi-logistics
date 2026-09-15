import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface CityRef {
  id: string;
  code: string;
  name: string;
  countryId: string;
  countryIso2: string;
  countryName: string;
  timezone: string;
  status: 'HUB' | 'PARTNER' | 'PLANNED';
  isOrigin: boolean;
  isDestination: boolean;
}

export function useCities() {
  return useQuery({
    queryKey: ['reference-cities'],
    queryFn: () => api<CityRef[]>('/reference/cities'),
    staleTime: 5 * 60 * 1000,
  });
}

/** code ville -> référence complète (nom, pays...) — pour afficher le nom en regard d'un code partout. */
export function useCityLookup(): Record<string, CityRef> {
  const { data } = useCities();
  return useMemo(() => Object.fromEntries((data ?? []).map((c) => [c.code, c])), [data]);
}
