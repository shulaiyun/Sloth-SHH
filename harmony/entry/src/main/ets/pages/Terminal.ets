import { common } from '@kit.AbilityKit';
import { promptAction, router } from '@kit.ArkUI';
import { HostRecord } from '../model/Host';
import { HostRepository } from '../model/HostRepository';
import {
  SshSessionManager,
  TerminalSession
} from '../model/SshSessionManager';

interface TerminalParams {
  hostId?: string;
}

@Entry
@Component
struct Terminal {
  @State private host: HostRecord = new HostRecord();
  @State private output: string = '';
  @State private state: string = 'idle';
  @State private command: string = '';
  @State private running: boolean = false;
  @State private ready: boolean = false;
  private repository: HostRepository = new HostRepository(getContext(this) as common.UIAbilityContext);
  private manager: SshSessionManager = SshSessionManager.shared();
  private sessionValue: TerminalSession | null = null;
  private scroller: Scroller = new Scroller();

  aboutToAppear(): void {
    this.prepare();
  }

  aboutToDisappear(): void {
    if (this.sessionValue !== null) {
      this.sessionValue.setListener(null);
    }
  }

  private async prepare(): Promise<void> {
    const params: TerminalParams = router.getParams() as TerminalParams;
    const id: string = params.hostId || '';
    const host: HostRecord | null = await this.repository.find(id);
    if (host === null) {
      promptAction.showToast({ message: '服务器资料不存在' });
      router.back();
      return;
    }
    this.host = host;
    this.sessionValue = this.manager.session(host);
    this.sessionValue.setListener(() => this.sync());
    this.ready = true;
    this.sync();
    if (!this.sessionValue.connected()) {
      await this.connectSession();
    }
  }

  private sync(): void {
    if (this.sessionValue === null) {
      return;
    }
    this.output = this.sessionValue.output;
    this.state = this.sessionValue.state;
    this.running = this.sessionValue.running;
    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom);
    }, 30);
  }

  private async connectSession(): Promise<void> {
    if (this.sessionValue === null) {
      return;
    }
    const password: string = await this.repository.password(this.host.id);
    if (password.length === 0) {
      this.state = 'error';
      this.output += '\n[连接失败] 没有找到已保存的服务器密码，请编辑服务器资料。\n';
      return;
    }
    await this.sessionValue.open(password, async (fingerprint: string): Promise<boolean> => {
      if (this.host.fingerprint === fingerprint) {
        return true;
      }
      const changed: boolean = this.host.fingerprint.length > 0;
      const message: string = changed ?
        `服务器指纹与之前保存的不一致。\n\n旧指纹：\n${this.host.fingerprint}\n\n新指纹：\n${fingerprint}\n\n如果你没有更换服务器，请取消连接。` :
        `这是首次连接这台服务器，请核对服务器身份指纹：\n\n${fingerprint}`;
      const result: promptAction.ShowDialogSuccessResponse = await promptAction.showDialog({
        title: changed ? '服务器身份发生变化' : '确认服务器身份',
        message: message,
        buttons: [
          {
            text: '取消连接',
            color: '#667085'
          },
          {
            text: changed ? '仍然信任' : '信任并连接',
            color: changed ? '#D92D20' : '#2F6FED'
          }
        ]
      });
      if (result.index !== 1) {
        return false;
      }
      this.host.fingerprint = fingerprint;
      await this.repository.save(this.host);
      return true;
    });
    this.sync();
  }

  private async runCommand(value: string = this.command): Promise<void> {
    const command: string = value.trim();
    if (command.length === 0 || this.sessionValue === null || !this.sessionValue.connected()) {
      return;
    }
    this.command = '';
    await this.sessionValue.execute(command);
    this.sync();
  }

  private async confirmDisconnect(): Promise<void> {
    if (this.sessionValue === null) {
      return;
    }
    const result: promptAction.ShowDialogSuccessResponse = await promptAction.showDialog({
      title: '断开 SSH 连接？',
      message: '断开后会保留当前终端记录，可以稍后重新连接。',
      buttons: [
        {
          text: '继续使用',
          color: '#667085'
        },
        {
          text: '确认断开',
          color: '#D92D20'
        }
      ]
    });
    if (result.index === 1) {
      await this.sessionValue.disconnect();
      this.sync();
    }
  }

  private stateText(): string {
    if (this.state === 'connected') {
      return '● 已连接';
    }
    if (this.state === 'connecting') {
      return '◌ 正在连接';
    }
    if (this.state === 'error') {
      return '! 连接失败';
    }
    if (this.state === 'disconnected') {
      return '○ 已断开';
    }
    return '○ 未连接';
  }

  private stateColor(): string {
    if (this.state === 'connected') {
      return '#18A675';
    }
    if (this.state === 'error') {
      return '#D14343';
    }
    if (this.state === 'connecting') {
      return '#D28B22';
    }
    return '#7D899C';
  }

  @Builder
  private quickCommand(label: string, command: string) {
    Button(label)
      .height(36)
      .fontSize(12)
      .fontColor('#40506A')
      .backgroundColor('#E9EEF5')
      .borderRadius(11)
      .margin({ right: 7 })
      .enabled(this.state === 'connected' && !this.running)
      .onClick(() => this.runCommand(command))
  }

  build() {
    Column() {
      Row({ space: 10 }) {
        Button('‹')
          .width(42)
          .height(42)
          .fontSize(26)
          .fontColor('#40506A')
          .backgroundColor('#E9EEF5')
          .borderRadius(13)
          .onClick(() => router.back())

        Column({ space: 2 }) {
          Text(this.host.name || '终端')
            .fontSize(19)
            .fontWeight(FontWeight.Bold)
            .fontColor('#172133')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(`${this.host.username}@${this.host.hostname}:${this.host.port}`)
            .fontSize(11)
            .fontColor('#778398')
            .maxLines(1)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Text(this.stateText())
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.stateColor())

        if (this.state === 'connected' || this.state === 'connecting') {
          Button('断开')
            .height(40)
            .fontSize(13)
            .fontColor('#C43C36')
            .backgroundColor('#FFF0EF')
            .borderRadius(12)
            .onClick(() => this.confirmDisconnect())
        } else {
          Button('重新连接')
            .height(40)
            .fontSize(13)
            .fontColor('#FFFFFF')
            .backgroundColor('#2F6FED')
            .borderRadius(12)
            .onClick(() => this.connectSession())
        }
      }
      .width('100%')
      .height(66)
      .padding({ left: 12, right: 12 })
      .backgroundColor('#F8FAFD')
      .border({ width: { bottom: 1 }, color: '#DCE4EF' })

      Scroll() {
        Row() {
          this.quickCommand('系统概览', 'uname -a && uptime')
          this.quickCommand('CPU/内存', 'top -bn1 | head -15')
          this.quickCommand('磁盘', 'df -h')
          this.quickCommand('网络', 'ip -br address && ip route')
          this.quickCommand('运行服务', 'systemctl --failed --no-pager')
        }
        .padding({ left: 10, right: 10, top: 7, bottom: 7 })
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
      .height(52)
      .backgroundColor('#F4F7FB')
      .border({ width: { bottom: 1 }, color: '#DDE5F0' })

      Scroll(this.scroller) {
        if (!this.ready) {
          Column({ space: 12 }) {
            LoadingProgress()
              .width(36)
              .height(36)
              .color('#6B8CFF')
            Text('正在准备终端…')
              .fontSize(13)
              .fontColor('#8490A2')
          }
          .width('100%')
          .height('100%')
          .justifyContent(FlexAlign.Center)
        } else {
          Text(this.output.length > 0 ? this.output : '正在建立安全连接…')
            .width('100%')
            .minHeight('100%')
            .fontSize(13)
            .fontFamily('monospace')
            .lineHeight(20)
            .fontColor('#DCE5F3')
            .copyOption(CopyOptions.LocalDevice)
            .padding({ left: 14, right: 14, top: 14, bottom: 30 })
        }
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Auto)
      .backgroundColor('#0D1420')

      Row() {
        Text(this.running ? '正在执行命令，请稍候…' : '命令模式：每次发送一条命令并返回完整结果')
          .fontSize(10)
          .fontColor(this.running ? '#D18A27' : '#7C899C')
        Blank()
        Button('清空显示')
          .height(30)
          .fontSize(11)
          .fontColor('#607086')
          .backgroundColor(Color.Transparent)
          .onClick(() => {
            if (this.sessionValue !== null) {
              this.sessionValue.clear();
            }
          })
      }
      .width('100%')
      .height(39)
      .padding({ left: 13, right: 8 })
      .backgroundColor('#F8FAFD')
      .border({ width: { top: 1 }, color: '#DCE4EF' })

      Row({ space: 8 }) {
        TextInput({ text: this.command, placeholder: this.state === 'connected' ? '输入服务器命令' : '连接后才能输入命令' })
          .height(48)
          .fontSize(13)
          .fontFamily('monospace')
          .fontColor('#172133')
          .placeholderColor('#98A2B3')
          .backgroundColor('#FFFFFF')
          .borderRadius(13)
          .border({ width: 1, color: '#D5DEEB' })
          .layoutWeight(1)
          .enabled(this.state === 'connected' && !this.running)
          .onChange((value: string) => this.command = value)
          .onSubmit(() => this.runCommand())
        Button(this.running ? '执行中' : '运行')
          .height(48)
          .fontSize(14)
          .fontColor('#FFFFFF')
          .backgroundColor('#2F6FED')
          .borderRadius(13)
          .enabled(this.state === 'connected' && !this.running && this.command.trim().length > 0)
          .onClick(() => this.runCommand())
      }
      .width('100%')
      .padding({ left: 10, right: 10, top: 8, bottom: 12 })
      .backgroundColor('#F4F7FB')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F4F7FB')
  }
}
