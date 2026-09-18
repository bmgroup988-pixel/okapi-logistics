import { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allLabel?: string;
}

/**
 * Menu déroulant à choix multiple avec case "Toutes" — même logique
 * d'ouverture/fermeture qu'un `<select>` simple (devise), mais permet de
 * choisir une, plusieurs ou toutes les options (ex. agences, pays).
 */
export function MultiSelectDropdown({ label, options, selected, onChange, allLabel = 'Toutes' }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const allSelected = selected.length === 0;
  const summary = allSelected
    ? allLabel
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? '1 sélectionné')
      : `${selected.length} sélectionnés`;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className="msd" ref={ref}>
      <label>{label}</label>
      <button type="button" className="msd-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{summary}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="msd-panel" role="listbox">
          <label className="msd-option msd-all">
            <input type="checkbox" checked={allSelected} onChange={() => onChange([])} />
            {allLabel}
          </label>
          <div className="msd-sep" />
          {options.map((o) => (
            <label key={o.value} className="msd-option">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
