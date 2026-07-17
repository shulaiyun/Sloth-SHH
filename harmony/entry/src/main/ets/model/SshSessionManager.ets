import { buffer } from '@kit.ArkTS';
import {
  Client,
  Config,
  DisconnectReason,
  ExecOutput,
  PublicKey,
  connect
} from '@ohos-rs/ssh';
import { HostRecord } from './Host';

export type HostKeyVerifier = (fingerprint: string) => Promise<boolean>;
export type SessionListener = () => void;

export class TerminalSession {
  host: HostRecord;
  state: string = 'idle';
  output: string = '';
  error: string = '';
  running: boolean = false;
  private client: Client | null = null;
  private listener: SessionListener | null = null;

  constructor(host: HostRecord) {
    this.host = HostRecord.copy(host);
  }

  setListener(listener: SessionListener | null): void {
    this.listener = listener;
  }

  connected(): boolean {
    return this.state === 'connected' && this.client !== null && !this.client.isClosed();
  }

  private notify(): void {
    if (this.listener !== null) {
      this.listener();
    }
  }

  private append(text: string): void {
    this.output += text;
    if (this.output.length > 200_000) {
      this.output = this.output.slice(this.output.length - 160_000);
    }
    this.notify();
  }

  async open(password: string, verifier: HostKeyVerifier): Promise<void> {
    if (this.connected() || this.state === 'connecting') {
      return;
    }
    this.state = 'connecting';
    this.error = '';
    this.notify();
    try {
      const config: Config = {
        client: {
          inactivityTimeout: 30_000
        },
        checkServerKey: async (key: PublicKey): Promise<boolean> => {
          return verifier(key.fingerprint());
        },
        authBanner: (banner: string): void => {
          if (banner.length > 0) {
            this.append(`\n${banner}\n`);
          }
        }
      };
      const client: Client = await connect(`${this.host.hostname}:${this.host.port}`, config);
      const authenticated: boolean = await client.authenticatePassword(this.host.username, password);
      if (!authenticated) {
        await client.disconnect(DisconnectReason.AuthCancelledByUser, 'Authentication failed', 'zh-CN');
        throw new Error('AUTH_FAILED');
      }
      this.client = client;
      this.state = 'connected';
      this.append(`\n● SlothSSH 鸿蒙终端已连接 ${this.host.username}@${this.host.hostname}\n`);
      this.notify();
    } catch (caught) {
      const error: Error = caught as Error;
      this.client = null;
      this.state = 'error';
      this.error = this.explain(error.message || `${error}`);
      this.append(`\n[连接失败] ${this.error}\n`);
      this.notify();
    }
  }

  async execute(command: string): Promise<void> {
    if (!this.connected() || this.client === null || this.running) {
      return;
    }
    this.running = true;
    this.append(`\n${this.host.username}@${this.host.hostname} $ ${command}\n`);
    try {
      const result: ExecOutput = await this.client.exec(command);
      const bytes: Uint8Array = new Uint8Array(result.output);
      const text: string = buffer.from(bytes).toString('utf8');
      if (text.length > 0) {
        this.append(text.endsWith('\n') ? text : `${text}\n`);
      }
      this.append(`[退出状态 ${result.status}]\n`);
    } catch (caught) {
      const error: Error = caught as Error;
      this.append(`[命令执行失败] ${this.explain(error.message || `${error}`)}\n`);
      if (this.client.isClosed()) {
        this.state = 'disconnected';
      }
    } finally {
      this.running = false;
      this.notify();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client !== null && !this.client.isClosed()) {
      try {
        await this.client.disconnect(DisconnectReason.ByApplication, 'Disconnected by user', 'zh-CN');
      } catch (_error) {
        // The remote side may have already closed the connection.
      }
    }
    this.client = null;
    this.state = 'disconnected';
    this.append('\n● SSH 连接已断开，终端记录已保留。\n');
    this.notify();
  }

  clear(): void {
    this.output = '';
    this.notify();
  }

  private explain(message: string): string {
    const normalized: string = message.toLowerCase();
    if (normalized.includes('auth') || normalized.includes('password')) {
      return '用户名或密码错误，请编辑服务器资料后重试。';
    }
    if (normalized.includes('timeout') || normalized.includes('timed out')) {
      return '连接超时，请检查服务器地址、端口、防火墙和当前网络。';
    }
    if (normalized.includes('refused')) {
      return '服务器拒绝连接，SSH 端口可能错误或 SSH 服务尚未启动。';
    }
    if (normalized.includes('key') || normalized.includes('fingerprint')) {
      return '服务器身份指纹校验未通过，请确认服务器是否发生更换。';
    }
    if (normalized.includes('resolve') || normalized.includes('dns') || normalized.includes('lookup')) {
      return '无法解析服务器地址，请检查 IP 地址或域名。';
    }
    return message.length > 0 ? message : '发生未知连接错误，请检查服务器配置。';
  }
}

export class SshSessionManager {
  private static singleton: SshSessionManager = new SshSessionManager();
  private sessions: Map<string, TerminalSession> = new Map();

  static shared(): SshSessionManager {
    return SshSessionManager.singleton;
  }

  session(host: HostRecord): TerminalSession {
    const existing: TerminalSession | undefined = this.sessions.get(host.id);
    if (existing !== undefined) {
      existing.host = HostRecord.copy(host);
      return existing;
    }
    const created: TerminalSession = new TerminalSession(host);
    this.sessions.set(host.id, created);
    return created;
  }

  connected(id: string): boolean {
    const session: TerminalSession | undefined = this.sessions.get(id);
    return session !== undefined && session.connected();
  }
}
