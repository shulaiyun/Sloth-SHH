import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { HostRecord } from './Host';
import { SecureStore } from './SecureStore';

const PREFERENCES_NAME: string = 'slothssh_hosts';
const HOSTS_KEY: string = 'records';

export class HostRepository {
  private context: common.UIAbilityContext;
  private secrets: SecureStore = new SecureStore();

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  private async storage(): Promise<preferences.Preferences> {
    return preferences.getPreferences(this.context, PREFERENCES_NAME);
  }

  async all(): Promise<Array<HostRecord>> {
    const storage: preferences.Preferences = await this.storage();
    const raw: string = await storage.get(HOSTS_KEY, '[]') as string;
    let decoded: Array<HostRecord> = [];
    try {
      decoded = JSON.parse(raw) as Array<HostRecord>;
    } catch (_error) {
      decoded = [];
    }
    const hosts: Array<HostRecord> = decoded.map((item: HostRecord) => HostRecord.fromJson(item));
    hosts.sort((left: HostRecord, right: HostRecord): number => {
      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    return hosts;
  }

  async find(id: string): Promise<HostRecord | null> {
    const hosts: Array<HostRecord> = await this.all();
    const found: HostRecord | undefined = hosts.find((item: HostRecord) => item.id === id);
    return found ? HostRecord.copy(found) : null;
  }

  async save(host: HostRecord): Promise<void> {
    const hosts: Array<HostRecord> = await this.all();
    const index: number = hosts.findIndex((item: HostRecord) => item.id === host.id);
    if (index >= 0) {
      hosts[index] = HostRecord.copy(host);
    } else {
      hosts.push(HostRecord.copy(host));
    }
    const storage: preferences.Preferences = await this.storage();
    await storage.put(HOSTS_KEY, JSON.stringify(hosts));
    await storage.flush();
  }

  async remove(id: string): Promise<void> {
    const hosts: Array<HostRecord> = await this.all();
    const remaining: Array<HostRecord> = hosts.filter((item: HostRecord) => item.id !== id);
    const storage: preferences.Preferences = await this.storage();
    await storage.put(HOSTS_KEY, JSON.stringify(remaining));
    await storage.flush();
    await this.secrets.removePassword(id);
  }

  async savePassword(id: string, password: string): Promise<void> {
    await this.secrets.savePassword(id, password);
  }

  async password(id: string): Promise<string> {
    return this.secrets.password(id);
  }
}
