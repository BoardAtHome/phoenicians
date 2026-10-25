import type { GameState } from '@phoenicians/engine';
import type { Game, State, StorageAPI } from 'boardgame.io';
import { Master } from 'boardgame.io/master';
import type { SocketIO } from 'boardgame.io/server';

type PubSub = { publish: (channel: string, payload: unknown) => void };

/**
 * Closes reaction windows on the server clock. Clients used to ask for the close when their
 * countdown ran out, so a window stayed open for as long as no connected client got a move
 * through (a phone with a dead connection, a sleeping tab, everyone offline).
 *
 * The close runs as a normal `closeWindow` move in the match's move queue, so it cannot race
 * a player's move, and everyone connected gets the new state.
 */
export class WindowTimers {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private game: Game,
    private db: StorageAPI.Async,
    private transport: SocketIO,
    /** Extra wait after the deadline, so the close never lands a hair early. */
    private slackMs = 50,
  ) {}

  /** Call with every state saved for a match: (re)arms or clears that match's timer. */
  track(matchID: string, state: State<GameState>) {
    clearTimeout(this.timers.get(matchID));
    this.timers.delete(matchID);
    const window = state.G.window;
    if (!window || window.deadline === null || state.ctx.gameover !== undefined) return;
    const delay = Math.max(0, window.deadline - Date.now()) + this.slackMs;
    const windowId = window.id;
    this.timers.set(matchID, setTimeout(() => void this.expire(matchID, windowId), delay));
  }

  /** Arms timers for matches that were saved with a window open, e.g. before a restart. */
  async trackAll() {
    const ids = await this.db.listMatches({ gameName: this.game.name, where: { isGameover: false } });
    for (const matchID of ids) {
      const { state } = await this.db.fetch(matchID, { state: true });
      if (state) this.track(matchID, state as State<GameState>);
    }
  }

  stop() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private async expire(matchID: string, windowId: number) {
    this.timers.delete(matchID);
    try {
      await this.transport.getMatchQueue(matchID).add(async () => {
        const { state } = await this.db.fetch(matchID, { state: true });
        const window = (state as State<GameState> | undefined)?.G.window;
        if (!state || !window || window.id !== windowId) return;
        // Any seat can send it, since closeWindow ignores who asks. Without an auth the Master skips the credentials check.
        const playerID = state.ctx.playOrder[0]!;
        const pubSub = (this.transport as unknown as { pubSub: PubSub }).pubSub;
        const master = new Master(this.game, this.db, { send: () => {}, sendAll: (payload) => pubSub.publish(`MATCH-${matchID}`, payload) }, undefined as never);
        const action = { type: 'MAKE_MOVE' as const, payload: { type: 'closeWindow', args: [windowId], playerID, credentials: '' } };
        await master.onUpdate(action, state._stateID, matchID, playerID);
      });
    } catch (err) {
      console.error(`Could not close reaction window ${windowId} of match ${matchID}`, err);
    }
  }
}
