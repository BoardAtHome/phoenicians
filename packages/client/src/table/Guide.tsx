import { useState } from 'react';
import { RESOURCES, type GameConfig } from '@phoenicians/engine';
import { CATEGORY_LABEL, RESOURCE_LABEL, costText } from '../format';
import {
  STRUCTURES_HELP,
  WIN_HELP,
  attackHelp,
  calamityHelp,
  curseEffect,
  curseWhen,
  divineCoinHelp,
  evaluationHelp,
  evaluationLabel,
  expeditionHelp,
  guessHelp,
  prophecyGoal,
  prophecyHow,
  resourceHelp,
  ritualHelp,
  structureHelp,
} from '../help';
import { Icon } from './Icon';
import { CostChips } from './Market';
import { CATEGORIES } from './Seat';
import { Sheet } from './Sheet';

export const GUIDE_TABS = ['Basics', 'Prophecies', 'Market', 'Curses', 'Calamities', 'Resources'] as const;
export type GuideTab = (typeof GUIDE_TABS)[number];

function Basics({ config }: { config: GameConfig }) {
  const c = config.costs;
  return (
    <>
      <p className="small">
        Everyone has a secret <b>Prophecy</b>. Fulfil yours and you win. Each turn has two parts: actions, then an expedition.
      </p>
      <div className="section-label"><span>1 · Actions</span></div>
      <p className="small">Spend resources on as many of these as you can afford, in any order:</p>
      <ul className="guide-list small">
        <li><b>Build</b> a structure from the Market. {STRUCTURES_HELP}</li>
        <li><b>Attack</b> ({costText(c.attack)}): {attackHelp()}</li>
        <li><b>Ritual</b> ({costText(c.ritual)}): {ritualHelp()}</li>
        <li><b>Divine Coin</b> ({costText(c.divineCoin)}): {divineCoinHelp(config)}</li>
        <li><b>Guess a Prophecy</b> ({c.guessProphecy} Divine Coin{c.guessProphecy === 1 ? '' : 's'}): {guessHelp()}</li>
        <li><b>Play a Curse</b> from your hand.</li>
      </ul>
      <div className="section-label"><span>2 · Set out on an expedition</span></div>
      <p className="small">{expeditionHelp(config)} This is how you collect resources, so push your luck.</p>
      <div className="section-label"><span>Winning</span></div>
      <p className="small">{WIN_HELP}</p>
      <div className="section-label"><span>On other players' turns</span></div>
      <p className="small">
        When someone acts and you hold a Curse that answers it, a reaction window opens for {config.reactions.windowSeconds} seconds. Play the Curse or let it happen.
        Nobody else sees that you could have answered.
      </p>
    </>
  );
}

function Prophecies({ config }: { config: GameConfig }) {
  const kinds = [...new Set(config.prophecies.map((p) => p.evaluation))];
  return (
    <>
      <p className="small">
        You get one secret Prophecy at the start. Rivals can spend Divine Coins to guess it, and a right guess eliminates you, so try not to make yours obvious.
      </p>
      {kinds.map((k) => (
        <p key={k} className="small muted">{evaluationHelp(config.prophecies.find((p) => p.evaluation === k)!)}</p>
      ))}
      {config.prophecies.map((p) => (
        <div key={p.id} className="row-card">
          <span className="row-main">
            <span><b>{p.name}</b> <span className="tag">{evaluationLabel(p)}</span></span>
            <span className="small"><b>{prophecyGoal(p)}</b></span>
            <span className="small muted">{prophecyHow(config, p)}</span>
          </span>
        </div>
      ))}
    </>
  );
}

function Market({ config }: { config: GameConfig }) {
  return (
    <>
      <p className="small">{STRUCTURES_HELP} {config.shop.slots} buildings are face up at a time; a new one is revealed when one is built.</p>
      {CATEGORIES.map((cat) => {
        const list = config.structures.filter((s) => s.category === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat}>
            <div className="section-label"><span>{CATEGORY_LABEL[cat]}</span></div>
            <p className="small muted">{structureHelp(config, list[0]!, true)}</p>
            {list.map((s) => (
              <div key={s.id} className="row-card slim">
                <span className={`chip round bg-${s.category}`}><Icon name={s.category} size={12} /></span>
                <b className="grow">{s.name}</b>
                <CostChips cost={s.cost} />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function Curses({ config }: { config: GameConfig }) {
  return (
    <>
      <p className="small">
        Perform a ritual to draw a Curse. Your hand is secret until you play a card. Most Curses can be played on your turn; reactions are offered to you when the moment comes.
      </p>
      {config.curses.map((c) => (
        <div key={c.id} className="row-card">
          <span className="row-main">
            <span><b>{c.name}</b> <span className="stars">{'★'.repeat(c.stars)}</span></span>
            <span className="small">{curseEffect(config, c)}</span>
            <span className="small muted">{curseWhen(c.id)}</span>
          </span>
        </div>
      ))}
    </>
  );
}

function Calamities({ config }: { config: GameConfig }) {
  return (
    <>
      <p className="small">{expeditionHelp(config)} Calamity Protection stops one.</p>
      {config.expedition.calamities.map((c) => (
        <div key={c.id} className="row-card">
          <span className="mini-card calamity"><Icon name="alert" size={14} /></span>
          <span className="row-main">
            <b>{c.name}</b>
            <span className="small muted">{calamityHelp(c)}</span>
          </span>
          <span className="small muted">×{c.copies}</span>
        </div>
      ))}
    </>
  );
}

function Resources({ config }: { config: GameConfig }) {
  return (
    <>
      <p className="small">You collect resource cards on expeditions and spend them on your turn. Your resources are visible to everyone.</p>
      {RESOURCES.map((r) => (
        <div key={r} className="row-card">
          <span className={`chip lg bg-${r}`}><Icon name={r} size={18} /></span>
          <span className="row-main">
            <b>{RESOURCE_LABEL[r]}</b>
            <span className="small muted">{resourceHelp(config, r)}</span>
          </span>
          <span className="small muted">×{config.expedition.resourceCards[r]}</span>
        </div>
      ))}
    </>
  );
}

const SECTIONS: Record<GuideTab, (props: { config: GameConfig }) => JSX.Element> = { Basics, Prophecies, Market, Curses, Calamities, Resources };

/** How to play, with every description drawn from this game's config. */
export function GuideSheet({ config, initial = 'Basics', onClose }: { config: GameConfig; initial?: GuideTab; onClose: () => void }) {
  const [tab, setTab] = useState<GuideTab>(initial);
  const Section = SECTIONS[tab];
  return (
    <Sheet title="How to play" subtitle="Numbers match this game's settings" onClose={onClose}>
      <div className="guide-tabs" role="tablist">
        {GUIDE_TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="guide">
        <Section config={config} />
      </div>
    </Sheet>
  );
}
