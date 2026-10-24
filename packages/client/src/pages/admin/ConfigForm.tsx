import {
  RESOURCES,
  STRUCTURE_CATEGORIES,
  type CalamityConfig,
  type GameConfig,
  type ProphecyConfig,
  type Resource,
  type ResourceMap,
} from '@phoenicians/engine';
import { CATEGORY_LABEL, RESOURCE_LABEL } from '../../format';

type Update = (change: (c: GameConfig) => void) => void;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** A number box. Empty input is kept as 0 so the config stays a number. */
function Num({ value, onChange, step = 1, min = 0, label }: { value: number; onChange: (n: number) => void; step?: number; min?: number; label?: string }) {
  return (
    <input
      className="num"
      type="number"
      aria-label={label}
      step={step}
      min={min}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

function ResourceInputs({ value, onChange, label }: { value: ResourceMap; onChange: (r: Resource, n: number) => void; label: string }) {
  return (
    <div className="res-inputs">
      {RESOURCES.map((r) => (
        <Field key={r} label={RESOURCE_LABEL[r]}>
          <Num label={`${label} ${RESOURCE_LABEL[r]}`} value={value[r]} onChange={(n) => onChange(r, n)} />
        </Field>
      ))}
    </div>
  );
}

function Section({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <details className="form-section" open>
      <summary>
        <strong>{title}</strong>
        {summary && <span className="muted small"> · {summary}</span>}
      </summary>
      <div className="stack">{children}</div>
    </details>
  );
}

function calamityParam(c: CalamityConfig, i: number, update: Update) {
  const effect = c.effect;
  const set = (patch: Record<string, unknown>) => update((cfg) => Object.assign(cfg.expedition.calamities[i]!.effect, patch));
  switch (effect.kind) {
    case 'discardInventoryCount':
      return <>Discard <Num label={`${c.name} count`} value={effect.count} onChange={(count) => set({ count })} /> cards</>;
    case 'discardInventoryFraction':
      return (
        <>
          Discard <Num label={`${c.name} fraction`} step={0.05} value={effect.fraction} onChange={(fraction) => set({ fraction })} /> of inventory, rounded
          <select value={effect.rounding} onChange={(e) => set({ rounding: e.target.value })}>
            <option value="up">up</option>
            <option value="down">down</option>
          </select>
        </>
      );
    case 'discardInventoryResource':
      return (
        <>
          Discard all
          <select value={effect.resource} onChange={(e) => set({ resource: e.target.value })}>
            {RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABEL[r]}</option>)}
          </select>
        </>
      );
    case 'discardExpedition':
      return <span className="muted">Discard the whole current expedition</span>;
  }
}

function metricText(p: ProphecyConfig): string {
  const m = p.metric;
  switch (m.kind) {
    case 'structuresDestroyed':
      return 'structures destroyed';
    case 'ritualsPerformed':
      return 'rituals performed';
    case 'structuresOwned':
      return m.category ? `${CATEGORY_LABEL[m.category]} structures owned` : 'structures owned';
    case 'resourceHeld':
      return `${RESOURCE_LABEL[m.resource]} held`;
  }
}

/**
 * Every number in the config as a form. Names and card text can be edited too;
 * changes to how a card works need a new build.
 */
export function ConfigForm({ config, update }: { config: GameConfig; update: Update }) {
  const deckResources = sum(RESOURCES.map((r) => config.expedition.resourceCards[r]));
  const deckCalamities = sum(config.expedition.calamities.map((c) => c.copies));
  const curseCopies = sum(config.curses.map((c) => c.copies));
  const buildingCopies = sum(config.structures.map((s) => s.copies));

  return (
    <div className="config-form stack">
      <Section title="Players and setup">
        <div className="row">
          <Field label="Fewest players"><Num value={config.players.min} min={1} onChange={(n) => update((c) => { c.players.min = n; })} /></Field>
          <Field label="Most players"><Num value={config.players.max} min={1} onChange={(n) => update((c) => { c.players.max = n; })} /></Field>
          <Field label="Starting Curses"><Num value={config.setup.startingCurses} onChange={(n) => update((c) => { c.setup.startingCurses = n; })} /></Field>
          <Field label="Curse hand limit" hint="Empty = no limit">
            <input
              className="num"
              type="number"
              min={0}
              value={config.setup.curseHandLimit ?? ''}
              onChange={(e) => update((c) => { c.setup.curseHandLimit = e.target.value === '' ? null : Number(e.target.value); })}
            />
          </Field>
          <Field label="Starting Divine Coins"><Num value={config.setup.divineCoins} onChange={(n) => update((c) => { c.setup.divineCoins = n; })} /></Field>
        </div>
        <span className="small">Starting resources (taken from the Expedition deck)</span>
        <ResourceInputs label="Starting" value={config.setup.startingResources} onChange={(r, n) => update((c) => { c.setup.startingResources[r] = n; })} />
      </Section>

      <Section title="Costs">
        {(['attack', 'ritual', 'divineCoin'] as const).map((key) => (
          <div key={key} className="stack">
            <span className="small">{key === 'attack' ? 'Attack' : key === 'ritual' ? 'Ritual' : 'Divine Coin'}</span>
            <ResourceInputs label={key} value={config.costs[key]} onChange={(r, n) => update((c) => { c.costs[key][r] = n; })} />
          </div>
        ))}
        <Field label="Divine Coins per Prophecy guess"><Num value={config.costs.guessProphecy} onChange={(n) => update((c) => { c.costs.guessProphecy = n; })} /></Field>
      </Section>

      <Section title="Expedition deck" summary={`${deckResources + deckCalamities} cards: ${deckResources} resources, ${deckCalamities} Calamities`}>
        <ResourceInputs label="Deck" value={config.expedition.resourceCards} onChange={(r, n) => update((c) => { c.expedition.resourceCards[r] = n; })} />
        <Field label="Draws at the start of an expedition that ignore Calamities">
          <Num value={config.expedition.ignoredCalamityDraws} onChange={(n) => update((c) => { c.expedition.ignoredCalamityDraws = n; })} />
        </Field>
        <table className="form-table">
          <thead><tr><th>Calamity</th><th>Copies</th><th>Effect</th></tr></thead>
          <tbody>
            {config.expedition.calamities.map((cal, i) => (
              <tr key={cal.id}>
                <td><input value={cal.name} onChange={(e) => update((c) => { c.expedition.calamities[i]!.name = e.target.value; })} /></td>
                <td><Num label={`${cal.name} copies`} value={cal.copies} onChange={(n) => update((c) => { c.expedition.calamities[i]!.copies = n; })} /></td>
                <td className="row">{calamityParam(cal, i, update)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Shop and buildings" summary={`${buildingCopies} building cards`}>
        <Field label="Shop slots"><Num value={config.shop.slots} onChange={(n) => update((c) => { c.shop.slots = n; })} /></Field>
        <table className="form-table">
          <thead>
            <tr><th>Building</th><th>Category</th>{RESOURCES.map((r) => <th key={r}>{RESOURCE_LABEL[r]}</th>)}<th>Copies</th></tr>
          </thead>
          <tbody>
            {config.structures.map((s, i) => (
              <tr key={s.id}>
                <td><input value={s.name} onChange={(e) => update((c) => { c.structures[i]!.name = e.target.value; })} /></td>
                <td>
                  <select value={s.category} onChange={(e) => update((c) => { c.structures[i]!.category = e.target.value as typeof s.category; })}>
                    {STRUCTURE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>)}
                  </select>
                </td>
                {RESOURCES.map((r) => (
                  <td key={r}><Num label={`${s.name} ${RESOURCE_LABEL[r]}`} value={s.cost[r]} onChange={(n) => update((c) => { c.structures[i]!.cost[r] = n; })} /></td>
                ))}
                <td><Num label={`${s.name} copies`} value={s.copies} onChange={(n) => update((c) => { c.structures[i]!.copies = n; })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Prophecies" summary={`${sum(config.prophecies.map((p) => p.copies))} cards`}>
        <table className="form-table">
          <thead><tr><th>Prophecy</th><th>Goal</th><th>Target</th><th>Copies</th></tr></thead>
          <tbody>
            {config.prophecies.map((p, i) => (
              <tr key={p.id}>
                <td><input value={p.name} onChange={(e) => update((c) => { c.prophecies[i]!.name = e.target.value; })} /></td>
                <td className="small">{p.evaluation === 'cumulative' ? 'Cumulative' : 'Conditional'}: {metricText(p)}</td>
                <td><Num label={`${p.name} target`} min={1} value={p.threshold} onChange={(n) => update((c) => { c.prophecies[i]!.threshold = n; })} /></td>
                <td><Num label={`${p.name} copies`} value={p.copies} onChange={(n) => update((c) => { c.prophecies[i]!.copies = n; })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Curses" summary={`${curseCopies} cards in the deck`}>
        <table className="form-table">
          <thead><tr><th>Curse</th><th>Stars</th><th>Copies</th><th>Numbers on the card</th></tr></thead>
          <tbody>
            {config.curses.map((curse, i) => (
              <tr key={curse.id}>
                <td>
                  <input value={curse.name} onChange={(e) => update((c) => { c.curses[i]!.name = e.target.value; })} />
                  <textarea className="small" rows={2} value={curse.text} onChange={(e) => update((c) => { c.curses[i]!.text = e.target.value; })} />
                </td>
                <td>
                  <select value={curse.stars} onChange={(e) => update((c) => { c.curses[i]!.stars = Number(e.target.value) as 1 | 2 | 3; })}>
                    {[1, 2, 3].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                  </select>
                </td>
                <td><Num label={`${curse.name} copies`} value={curse.copies} onChange={(n) => update((c) => { c.curses[i]!.copies = n; })} /></td>
                <td className="row">
                  {Object.keys(curse.params).length === 0 && <span className="muted small">None</span>}
                  {Object.entries(curse.params).map(([key, value]) => (
                    <Field key={key} label={key}>
                      <Num label={`${curse.name} ${key}`} value={value} onChange={(n) => update((c) => { c.curses[i]!.params[key] = n; })} />
                    </Field>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Reaction windows">
        <div className="row">
          <Field label="Seconds to react" hint="0 turns reactions off">
            <Num step={0.5} value={config.reactions.windowSeconds} onChange={(n) => update((c) => { c.reactions.windowSeconds = n; })} />
          </Field>
          <Field label="Longest pause while choosing a response (seconds)">
            <Num value={config.reactions.holdSeconds ?? 30} onChange={(n) => update((c) => { c.reactions.holdSeconds = n; })} />
          </Field>
        </div>
      </Section>
    </div>
  );
}
