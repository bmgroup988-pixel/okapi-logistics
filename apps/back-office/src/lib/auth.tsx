import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, hasRefreshToken, setTokens } from './api';

/** Miroir de MFA_REQUIRED_ROLES (packages/shared/src/permissions.ts) — rôles
 * pour lesquels la double authentification est obligatoire. */
const MFA_REQUIRED_ROLES = ['SUPER_ADMIN', 'ADMIN_DAF'];

export interface Me {
  id: string;
  email: string;
  fullName: string;
  locale: string;
  roles: Array<{ code: string; scopeCountryId: string | null; scopeAgencyId: string | null }>;
  permissions: string[];
  mfaEnabled: boolean;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string, otp?: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (perm: string) => boolean;
  /** Compte fournisseur pur (portail self-service), sans accès staff — docs/11 §7. */
  isSupplierOnly: boolean;
  /** SUPER_ADMIN/ADMIN_DAF sans MFA activée — bloque tout sauf /profile côté API. */
  mfaSetupRequired: boolean;
  /** Recharge /me — à appeler après activation réussie de la MFA. */
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!hasRefreshToken()) {
        setLoading(false);
        return;
      }
      try {
        setMe(await api<Me>('/me'));
      } catch {
        clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string, otp?: string) => {
    const tokens = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password, otp: otp || undefined },
    });
    setTokens(tokens.accessToken, tokens.refreshToken);
    setMe(await api<Me>('/me'));
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('okapi.refresh');
    try {
      if (refreshToken) await api('/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      /* ignore */
    }
    clearTokens();
    setMe(null);
  };

  const can = (perm: string) => !!me?.permissions.includes(perm);
  const isSupplierOnly = can('shipment:read') && !can('parcel:read');
  const mfaSetupRequired =
    !!me && !me.mfaEnabled && me.roles.some((r) => MFA_REQUIRED_ROLES.includes(r.code));

  const refreshMe = async () => {
    setMe(await api<Me>('/me'));
  };

  return (
    <Ctx.Provider
      value={{ me, loading, login, logout, can, isSupplierOnly, mfaSetupRequired, refreshMe }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth hors AuthProvider');
  return v;
}
