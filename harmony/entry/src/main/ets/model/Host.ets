export class HostRecord {
  id: string = '';
  name: string = '';
  hostname: string = '';
  port: number = 22;
  username: string = 'root';
  notes: string = '';
  favorite: boolean = false;
  fingerprint: string = '';

  static empty(): HostRecord {
    const host: HostRecord = new HostRecord();
    host.id = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    return host;
  }

  static copy(source: HostRecord): HostRecord {
    const host: HostRecord = new HostRecord();
    host.id = source.id;
    host.name = source.name;
    host.hostname = source.hostname;
    host.port = source.port;
    host.username = source.username;
    host.notes = source.notes;
    host.favorite = source.favorite;
    host.fingerprint = source.fingerprint;
    return host;
  }

  static fromJson(source: HostRecord): HostRecord {
    const host: HostRecord = HostRecord.empty();
    host.id = source.id || host.id;
    host.name = source.name || '';
    host.hostname = source.hostname || '';
    host.port = source.port || 22;
    host.username = source.username || 'root';
    host.notes = source.notes || '';
    host.favorite = source.favorite || false;
    host.fingerprint = source.fingerprint || '';
    return host;
  }
}
