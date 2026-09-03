import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading } from '../components/ui';

const KEYS = [
  'brand.navy',
  'brand.orange',
  'brand.turquoise',
  'brand.anthracite',
  'contact.email',
  'footer.slogan.fr',
  'footer.slogan.en',
  'footer.slogan.zh',
];

export function Branding() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings', 'brand'],
    queryFn: () => api<Record<string, unknown>>('/admin/settings'),
  });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data) {
      const v: Record<string, string> = {};
      for (const k of KEYS) v[k] = String(settings.data[k] ?? '');
      setValues(v);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      for (const k of KEYS) {
        await api(`/admin/settings/${encodeURIComponent(k)}`, {
          method: 'PUT',
          body: { value: values[k] ?? '' },
        });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (settings.isLoading) return <Loading />;

  return (
    <>
      <h1>Identité visuelle & pied de page</h1>
      <div className="card">
        {KEYS.map((k) => (
          <div className="field" key={k}>
            <label>{k}</label>
            <input
              value={values[k] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
            />
          </div>
        ))}
        <ErrorText error={save.error} />
        <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Enregistrer (versionné + tracé)
        </button>
      </div>
      <p className="muted">
        Les modifications sont journalisées (audit) et prises en compte immédiatement par la page
        publique de suivi via <span className="mono">/api/v1/public/branding</span>.
      </p>
    </>
  );
}
