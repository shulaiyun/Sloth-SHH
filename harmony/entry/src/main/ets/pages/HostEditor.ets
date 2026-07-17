import { common } from '@kit.AbilityKit';
import { promptAction, router } from '@kit.ArkUI';
import { HostRecord } from '../model/Host';
import { HostRepository } from '../model/HostRepository';

interface HostEditorParams {
  hostId?: string;
}

@Entry
@Component
struct HostEditor {
  @State private hostId: string = '';
  @State private name: string = '';
  @State private hostname: string = '';
  @State private port: string = '22';
  @State private username: string = 'root';
  @State private password: string = '';
  @State private notes: string = '';
  @State private favorite: boolean = false;
  @State private fingerprint: string = '';
  @State private passwordVisible: boolean = false;
  @State private saving: boolean = false;
  private repository: HostRepository = new HostRepository(getContext(this) as common.UIAbilityContext);

  aboutToAppear(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const params: HostEditorParams = router.getParams() as HostEditorParams;
    const id: string = params.hostId || '';
    if (id.length === 0) {
      const created: HostRecord = HostRecord.empty();
      this.hostId = created.id;
      return;
    }
    const host: HostRecord | null = await this.repository.find(id);
    if (host === null) {
      promptAction.showToast({ message: '没有找到这台服务器' });
      router.back();
      return;
    }
    this.hostId = host.id;
    this.name = host.name;
    this.hostname = host.hostname;
    this.port = `${host.port}`;
    this.username = host.username;
    this.notes = host.notes;
    this.favorite = host.favorite;
    this.fingerprint = host.fingerprint;
    this.password = await this.repository.password(host.id);
  }

  private async save(): Promise<void> {
    if (this.saving) {
      return;
    }
    const parsedPort: number = Number(this.port);
    if (this.name.trim().length === 0) {
      promptAction.showToast({ message: '请填写服务器名称' });
      return;
    }
    if (this.hostname.trim().length === 0) {
      promptAction.showToast({ message: '请填写 IP 地址或域名' });
      return;
    }
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      promptAction.showToast({ message: 'SSH 端口必须是 1–65535 之间的数字' });
      return;
    }
    if (this.username.trim().length === 0) {
      promptAction.showToast({ message: '请填写登录用户名' });
      return;
    }
    if (this.password.length === 0) {
      promptAction.showToast({ message: '请填写服务器密码' });
      return;
    }

    this.saving = true;
    const host: HostRecord = new HostRecord();
    host.id = this.hostId;
    host.name = this.name.trim();
    host.hostname = this.hostname.trim();
    host.port = parsedPort;
    host.username = this.username.trim();
    host.notes = this.notes.trim();
    host.favorite = this.favorite;
    host.fingerprint = this.fingerprint;
    try {
      await this.repository.save(host);
      await this.repository.savePassword(host.id, this.password);
      promptAction.showToast({ message: '服务器资料已安全保存' });
      router.back();
    } catch (caught) {
      const error: Error = caught as Error;
      promptAction.showToast({ message: `保存失败：${error.message || error}` });
    } finally {
      this.saving = false;
    }
  }

  private async remove(): Promise<void> {
    const result: promptAction.ShowDialogSuccessResponse = await promptAction.showDialog({
      title: '删除服务器',
      message: `确定删除“${this.name}”及其本地保存的密码吗？`,
      buttons: [
        {
          text: '取消',
          color: '#667085'
        },
        {
          text: '删除',
          color: '#D92D20'
        }
      ]
    });
    if (result.index !== 1) {
      return;
    }
    await this.repository.remove(this.hostId);
    promptAction.showToast({ message: '服务器已删除' });
    router.back();
  }

  @Builder
  private fieldLabel(label: string) {
    Text(label)
      .width('100%')
      .fontSize(13)
      .fontWeight(FontWeight.Medium)
      .fontColor('#48566B')
      .margin({ top: 13, bottom: 7 })
  }

  build() {
    Column() {
      Row({ space: 12 }) {
        Button('‹')
          .width(42)
          .height(42)
          .fontSize(26)
          .fontColor('#40506A')
          .backgroundColor('#E9EEF5')
          .borderRadius(13)
          .onClick(() => router.back())
        Column({ space: 2 }) {
          Text(this.name.length > 0 ? '编辑服务器' : '添加服务器')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor('#162237')
          Text('连接信息仅保存在当前设备')
            .fontSize(12)
            .fontColor('#738096')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 16, bottom: 10 })

      Scroll() {
        Column() {
          this.fieldLabel('服务器名称')
          TextInput({ text: this.name, placeholder: '例如：香港生产服务器' })
            .onChange((value: string) => this.name = value)
            .height(48)
            .fontColor('#172133')
            .placeholderColor('#98A2B3')
            .backgroundColor('#FFFFFF')
            .borderRadius(13)
            .border({ width: 1, color: '#DCE4F0' })

          this.fieldLabel('IP 地址或域名')
          TextInput({ text: this.hostname, placeholder: '192.168.1.10 或 server.example.com' })
            .onChange((value: string) => this.hostname = value)
            .height(48)
            .fontColor('#172133')
            .placeholderColor('#98A2B3')
            .backgroundColor('#FFFFFF')
            .borderRadius(13)
            .border({ width: 1, color: '#DCE4F0' })

          Row({ space: 12 }) {
            Column() {
              this.fieldLabel('登录用户名')
              TextInput({ text: this.username, placeholder: 'root' })
                .onChange((value: string) => this.username = value)
                .height(48)
                .fontColor('#172133')
                .backgroundColor('#FFFFFF')
                .borderRadius(13)
                .border({ width: 1, color: '#DCE4F0' })
            }
            .layoutWeight(1)

            Column() {
              this.fieldLabel('SSH 端口')
              TextInput({ text: this.port, placeholder: '22' })
                .type(InputType.Number)
                .onChange((value: string) => this.port = value)
                .height(48)
                .fontColor('#172133')
                .backgroundColor('#FFFFFF')
                .borderRadius(13)
                .border({ width: 1, color: '#DCE4F0' })
            }
            .width(112)
          }

          this.fieldLabel('服务器密码')
          Row({ space: 8 }) {
            TextInput({ text: this.password, placeholder: '输入用于 SSH 登录的密码' })
              .type(this.passwordVisible ? InputType.Normal : InputType.Password)
              .onChange((value: string) => this.password = value)
              .height(48)
              .fontColor('#172133')
              .placeholderColor('#98A2B3')
              .backgroundColor('#FFFFFF')
              .borderRadius(13)
              .border({ width: 1, color: '#DCE4F0' })
              .layoutWeight(1)
            Button(this.passwordVisible ? '隐藏' : '查看')
              .height(46)
              .fontSize(13)
              .fontColor('#40506A')
              .backgroundColor('#E9EEF5')
              .borderRadius(12)
              .onClick(() => this.passwordVisible = !this.passwordVisible)
          }

          Row({ space: 7 }) {
            Text('◆')
              .fontSize(11)
              .fontColor('#20A778')
            Text('密码使用鸿蒙 Asset Store Kit 安全存储，不写入普通配置文件')
              .fontSize(11)
              .fontColor('#6F7D91')
              .layoutWeight(1)
          }
          .width('100%')
          .padding({ top: 8, bottom: 2 })

          this.fieldLabel('管理备注')
          TextArea({ text: this.notes, placeholder: '机房、用途、到期时间等管理信息' })
            .onChange((value: string) => this.notes = value)
            .height(92)
            .fontColor('#172133')
            .placeholderColor('#98A2B3')
            .backgroundColor('#FFFFFF')
            .borderRadius(13)
            .border({ width: 1, color: '#DCE4F0' })

          Row() {
            Column({ space: 3 }) {
              Text('收藏服务器')
                .fontSize(14)
                .fontWeight(FontWeight.Medium)
                .fontColor('#35445B')
              Text('收藏后优先显示在主机列表顶部')
                .fontSize(11)
                .fontColor('#8490A3')
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Toggle({ type: ToggleType.Switch, isOn: this.favorite })
              .selectedColor('#2F6FED')
              .onChange((value: boolean) => this.favorite = value)
          }
          .width('100%')
          .padding(14)
          .margin({ top: 15 })
          .backgroundColor('#FFFFFF')
          .borderRadius(14)
          .border({ width: 1, color: '#E0E7F1' })

          if (this.fingerprint.length > 0) {
            Column({ space: 8 }) {
              Row() {
                Text('已信任的服务器指纹')
                  .fontSize(13)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#40506A')
                Blank()
                Button('清除')
                  .fontSize(12)
                  .fontColor('#C2413B')
                  .height(34)
                  .backgroundColor('#FFF1F0')
                  .onClick(() => this.fingerprint = '')
              }
              Text(this.fingerprint)
                .fontSize(11)
                .fontFamily('monospace')
                .fontColor('#66758A')
                .copyOption(CopyOptions.LocalDevice)
            }
            .width('100%')
            .padding(14)
            .margin({ top: 12 })
            .backgroundColor('#FFFFFF')
            .borderRadius(14)
            .border({ width: 1, color: '#E0E7F1' })
          }

          if (this.name.length > 0) {
            Button('删除这台服务器')
              .width('100%')
              .height(46)
              .fontSize(14)
              .fontColor('#C83C35')
              .backgroundColor('#FFF0EF')
              .borderRadius(13)
              .margin({ top: 18, bottom: 12 })
              .onClick(() => this.remove())
          }
        }
        .width('100%')
        .padding({ left: 18, right: 18, bottom: 24 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Auto)

      Row({ space: 10 }) {
        Button('取消')
          .height(48)
          .fontColor('#536176')
          .backgroundColor('#E9EEF5')
          .borderRadius(13)
          .layoutWeight(1)
          .onClick(() => router.back())
        Button(this.saving ? '正在保存…' : '保存服务器')
          .height(48)
          .fontColor('#FFFFFF')
          .backgroundColor('#2F6FED')
          .borderRadius(13)
          .layoutWeight(2)
          .enabled(!this.saving)
          .onClick(() => this.save())
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 10, bottom: 15 })
      .backgroundColor('#F8FAFD')
      .border({ width: { top: 1 }, color: '#DEE5EF' })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F4F7FB')
  }
}
