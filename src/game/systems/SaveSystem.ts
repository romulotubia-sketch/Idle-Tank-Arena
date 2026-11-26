import { playgamaBridge } from '../../platform/playgamaBridge';
import { SAVE_STORAGE_KEY, SAVE_VERSION } from '../constants';
import { SavePayload } from '../types';

export class SaveSystem {
  async load(): Promise<SavePayload | null> {
    const raw = await playgamaBridge.loadStorage(SAVE_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SavePayload;
      if (parsed && parsed.version === SAVE_VERSION) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async save(payload: Omit<SavePayload, 'version' | 'savedAt'>): Promise<void> {
    const record: SavePayload = {
      ...payload,
      version: SAVE_VERSION,
      savedAt: Date.now(),
    };
    await playgamaBridge.saveStorage(SAVE_STORAGE_KEY, JSON.stringify(record));
  }
}
