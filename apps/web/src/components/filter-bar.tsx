import { FilterInfo, MatchMode } from '@backslash/api-contract';
import { FormEvent, useState } from 'react';
import styles from './filter-bar.module.css';

export interface FilterBarProps {
  filters: FilterInfo[];
  onRun: (filters: string[], match: MatchMode) => void;
  onReset: () => void;
}

export function FilterBar({ filters, onRun, onReset }: FilterBarProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const [match, setMatch] = useState<MatchMode>(MatchMode.All);

  const toggle = (name: string) =>
    setChecked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Registry order keeps the query string stable.
    onRun(
      filters.map((f) => f.name).filter((n) => checked.includes(n)),
      match,
    );
  };

  return (
    <form className={styles.bar} onSubmit={submit} aria-label="Route filters">
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Filters</legend>
        {filters.map((f) => (
          <label key={f.name} className={styles.option} title={f.description}>
            <input type="checkbox" checked={checked.includes(f.name)} onChange={() => toggle(f.name)} />
            <code>{f.name}</code>
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Match</legend>
        {Object.values(MatchMode).map((m) => (
          <label key={m} className={styles.option}>
            <input type="radio" name="match" value={m} checked={match === m} onChange={() => setMatch(m)} />
            {m}
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary}>
          Show routes
        </button>
        <button type="button" onClick={onReset}>
          Overview
        </button>
      </div>
    </form>
  );
}
