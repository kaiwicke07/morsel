import { useEffect, useState } from 'react';
import { exportBackup } from '../lib/backup';
import { patchSettings } from '../lib/db';
import { todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/primitives';

/** Returns true once the file was handed to the share sheet or downloaded. */
async function shareOrDownload(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/** iOS only opens the share sheet straight from a tap, so the file is built first and shared on a second tap. */
export function BackupSheet({ photos: initial }: { photos: boolean }) {
  const nav = useNav();
  const [photos, setPhotos] = useState(initial);
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setFile(null);
    setErr(null);
    exportBackup(photos)
      .then(blob => live && setFile({ blob, name: `morsel-backup${photos ? '-photos' : ''}-${todayIso()}.json` }))
      .catch(() => live && setErr("Couldn't build the backup."));
    return () => {
      live = false;
    };
  }, [photos]);

  return (
    <Sheet onClose={nav.pop} label="Back up">
      {close => (
        <div className="stack" style={{ textAlign: 'center' }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{file ? 'Backup ready' : 'Packing your data…'}</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {err ?? (file ? `${(file.blob.size / 1024 / 1024).toFixed(1)} MB. Save it to Files or send it to yourself. API keys are not included.` : 'This takes a moment with photos.')}
          </p>
          <label className="row between" style={{ fontWeight: 600, textAlign: 'left' }}>
            Include photos
            <input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          </label>
          <button
            className="btn block accent"
            disabled={!file}
            onClick={async () => {
              if (!file) return;
              if (await shareOrDownload(file.blob, file.name)) {
                await patchSettings({ lastBackupAt: Date.now() });
                close();
                nav.showToast('Backed up');
              }
            }}
          >
            {file ? <Icon name="download" size={20} /> : <span className="spinner" />} Save or share
          </button>
        </div>
      )}
    </Sheet>
  );
}
