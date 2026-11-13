export interface UndoEntry<T = unknown> {
  id: string;
  kind: 'recipe' | 'shopping' | 'shopping_bulk' | string;
  payload: T;
  index: number;
  createdAt: number;
  expiresAt: number;
}

export interface PushUndoOptions<T> {
  id?: string;
  kind: UndoEntry<T>['kind'];
  payload: T;
  index?: number;
  ttlMs?: number;
  now?: number;
}

/**
 * In-memory timed undo stack for reversible client/service deletions.
 * Keeps deleted entries strictly in RAM for up to `ttlMs` (default 6000ms).
 */
export class UndoStore {
  private readonly defaultTtlMs: number;
  private entries: UndoEntry[] = [];
  private seq = 0;

  constructor(defaultTtlMs = 6000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public push<T>(options: PushUndoOptions<T>): UndoEntry<T> {
    const now = options.now ?? Date.now();
    this.clearExpired(now);
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const id = options.id || `undo_${now}_${++this.seq}`;
    const entry: UndoEntry<T> = {
      id,
      kind: options.kind,
      payload: options.payload,
      index: Math.max(0, options.index ?? 0),
      createdAt: now,
      expiresAt: now + ttlMs
    };
    this.entries.push(entry);
    return entry;
  }

  public undo<T = unknown>(id: string, now = Date.now()): UndoEntry<T> | null {
    this.clearExpired(now);
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const [entry] = this.entries.splice(idx, 1);
    if (entry.expiresAt < now) return null;
    return entry as UndoEntry<T>;
  }

  /**
   * Non-mutating helper that re-inserts a single item at its saved index
   * (clamped to `[0, list.length]`).
   */
  public static restoreAtIndex<T>(list: readonly T[], item: T, index: number): T[] {
    const next = list.slice();
    const clampedIndex = Math.max(0, Math.min(index, next.length));
    next.splice(clampedIndex, 0, item);
    return next;
  }

  public clearExpired(now = Date.now()): number {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.expiresAt >= now);
    return before - this.entries.length;
  }

  public size(now = Date.now()): number {
    this.clearExpired(now);
    return this.entries.length;
  }

  public clearAll(): void {
    this.entries = [];
  }
}

