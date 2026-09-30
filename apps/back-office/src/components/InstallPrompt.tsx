import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari — propriété non standard, pas de display-mode fiable.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !('MSStream' in window);
}

/**
 * Bannière d'installation — Android/Chrome/Edge : bouton qui déclenche
 * l'invite native (`beforeinstallprompt`), pas toujours proposée
 * spontanément par le navigateur (heuristiques d'engagement). iOS Safari :
 * AUCUNE invite automatique n'existe (limitation d'Apple, pas un bug ici) —
 * marche à suivre manuelle affichée à la place.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || isStandalone() || dismissed) return null;

  const ios = isIOS();
  if (!ios && !deferred) return null; // Android/desktop : rien tant que Chrome n'a pas proposé l'invite.

  return (
    <div
      className="card"
      style={{
        maxWidth: 360,
        margin: '0 auto 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
      }}
    >
      {ios ? (
        <p style={{ margin: 0 }}>
          <strong>Installer l'app :</strong> appuyez sur{' '}
          <span aria-label="Partager" style={{ fontWeight: 600 }}>
            ⬆︎ Partager
          </span>{' '}
          (barre du bas) puis « Sur l'écran d'accueil ».
        </p>
      ) : (
        <>
          <p style={{ margin: 0, flex: 1 }}>Installer l'app sur cet appareil, comme une app normale.</p>
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              await deferred?.prompt();
              await deferred?.userChoice;
              setDeferred(null);
            }}
          >
            Installer
          </button>
        </>
      )}
      <button
        type="button"
        className="btn ghost"
        aria-label="Fermer"
        onClick={() => setDismissed(true)}
        style={{ padding: '2px 8px' }}
      >
        ✕
      </button>
    </div>
  );
}
