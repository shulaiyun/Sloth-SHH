import { common } from '@kit.AbilityKit';
import { router } from '@kit.ArkUI';
import { HostRecord } from '../model/Host';
import { HostRepository } from '../model/HostRepository';
import { SshSessionManager } from '../model/SshSessionManager';

@Entry
@Component
struct Index {
  @State private hosts: Array<HostRecord> = [];
  @State private query: string = '';
  @State private loading: boolean = true;
  private repository: HostRepository = new HostRepository(getContext(this) as common.UIAbilityContext);
  private sessions: SshSessionManager = SshSessionManager.shared();

  aboutToAppear(): void {
    this.loadHosts();
  }

  onPageShow(): void {
    this.loadHosts();
  }

  private async loadHosts(): Promise<void> {
    this.loading = true;
    this.hosts = await this.repository.all();
    this.loading = false;
  }

  private visibleHosts(): Array<HostRecord> {
    const keyword: string = this.query.trim().toLowerCase();
    if (keyword.length === 0) {
      return this.hosts;
    }
    return this.hosts.filter((host: HostRecord): boolean => {
      return host.name.toLowerCase().includes(keyword) ||
        host.hostname.toLowerCase().includes(keyword) ||
        host.username.toLowerCase().includes(keyword) ||
        host.notes.toLowerCase().includes(keyword);
    });
  }

  private openEditor(id: string = ''): void {
    router.pushUrl({
      url: 'pages/HostEditor',
      params: {
        hostId: id
      }
    });
  }

  private openTerminal(host: HostRecord): void {
    router.pushUrl({
      url: 'pages/Terminal',
      params: {
        hostId: host.id
      }
    });
  }

  @Builder
  private hostCard(host: HostRecord) {
    Row({ space: 12 }) {
      Stack() {
        Text('▤')
          .fontSize(24)
          .fontColor('#2F6FED')
      }
      .width(48)
      .height(48)
      .borderRadius(15)
      .backgroundColor('#EAF1FF')

      Column({ space: 4 }) {
        Row({ space: 7 }) {
          if (host.favorite) {
            Text('★')
              .fontSize(14)
              .fontColor('#F0A43A')
          }
          Text(host.name.length > 0 ? host.name : host.hostname)
            .fontSize(17)
            .fontWeight(FontWeight.Medium)
            .fontColor('#172133')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Blank()
          Text(this.sessions.connected(host.id) ? '● 已连接' : '○ 未连接')
            .fontSize(11)
            .fontColor(this.sessions.connected(host.id) ? '#18A675' : '#8995A8')
        }
        .width('100%')

        Text(`${host.username}@${host.hostname}:${host.port}`)
          .fontSize(13)
          .fontColor('#68758A')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        if (host.notes.length > 0) {
          Text(host.notes)
            .fontSize(12)
            .fontColor('#8995A8')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Button('编辑')
        .fontSize(12)
        .fontColor('#536278')
        .height(36)
        .backgroundColor('#F2F5F9')
        .onClick(() => this.openEditor(host.id))
    }
    .width('100%')
    .padding(14)
    .borderRadius(18)
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#E2E8F2' })
    .shadow({ radius: 12, color: '#120E2038', offsetX: 0, offsetY: 5 })
    .onClick(() => this.openTerminal(host))
  }

  build() {
    Column() {
      Row({ space: 14 }) {
        Image($r('app.media.slothssh_logo'))
          .width(58)
          .height(58)
          .borderRadius(17)
          .objectFit(ImageFit.Cover)

        Column({ space: 2 }) {
          Text('SlothSSH')
            .fontSize(25)
            .fontWeight(FontWeight.Bold)
            .fontColor('#142033')
          Text('鸿蒙服务器工作台')
            .fontSize(13)
            .fontColor('#6D7A90')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Button('+ 添加')
          .height(42)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFFFFF')
          .backgroundColor('#2F6FED')
          .borderRadius(13)
          .onClick(() => this.openEditor())
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 18, bottom: 14 })

      TextInput({ text: this.query, placeholder: '搜索主机、IP、用户名或备注' })
        .height(48)
        .fontSize(14)
        .fontColor('#172133')
        .placeholderColor('#8A96A8')
        .backgroundColor('#FFFFFF')
        .borderRadius(15)
        .border({ width: 1, color: '#DCE4F0' })
        .margin({ left: 18, right: 18, bottom: 12 })
        .padding({ left: 15, right: 15 })
        .onChange((value: string) => {
          this.query = value;
        })

      Row() {
        Text(this.query.length > 0 ? '搜索结果' : '全部主机')
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor('#59677C')
        Blank()
        Text(`${this.visibleHosts().length}`)
          .fontSize(12)
          .fontColor('#8995A8')
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 4, bottom: 8 })

      if (this.loading) {
        Column({ space: 12 }) {
          LoadingProgress()
            .width(36)
            .height(36)
            .color('#2F6FED')
          Text('正在读取主机资料…')
            .fontSize(13)
            .fontColor('#77849A')
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.visibleHosts().length === 0) {
        Column({ space: 12 }) {
          Text('⌁')
            .fontSize(42)
            .fontColor('#8AA8E8')
          Text(this.query.length > 0 ? '没有找到匹配的服务器' : '还没有添加服务器')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor('#30405A')
          Text(this.query.length > 0 ? '换一个关键词试试' : '添加主机后即可安全连接 SSH')
            .fontSize(13)
            .fontColor('#7B8799')
          if (this.query.length === 0) {
            Button('添加第一台服务器')
              .fontColor('#FFFFFF')
              .backgroundColor('#2F6FED')
              .borderRadius(13)
              .margin({ top: 8 })
              .onClick(() => this.openEditor())
          }
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        List({ space: 11 }) {
          ForEach(this.visibleHosts(), (host: HostRecord) => {
            ListItem() {
              this.hostCard(host)
            }
          }, (host: HostRecord) => host.id)
        }
        .width('100%')
        .layoutWeight(1)
        .padding({ left: 16, right: 16, bottom: 20 })
        .scrollBar(BarState.Auto)
      }

      Row({ space: 7 }) {
        Text('◆')
          .fontSize(11)
          .fontColor('#22A77A')
        Text('密码由鸿蒙关键资产存储服务加密保护')
          .fontSize(11)
          .fontColor('#758297')
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 10, bottom: 14 })
      .border({ width: { top: 1 }, color: '#DFE6F0' })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F4F7FB')
  }
}
