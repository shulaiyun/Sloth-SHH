# SlothSSH HarmonyOS NEXT

SlothSSH 的 HarmonyOS NEXT 原生客户端，使用 ArkTS、ArkUI、Stage 模型以及鸿蒙关键资产存储服务开发。工程面向手机，同时声明支持平板和 2in1 设备。

## 当前功能

- SlothSSH 品牌名称与完整品牌图标
- 添加、编辑、搜索、收藏和删除服务器
- 保存服务器名称、IP/域名、SSH 端口、用户名及管理备注
- 服务器密码通过 Asset Store Kit 保存，不写入普通配置文件
- 首次连接显示 SHA-256 服务器指纹，确认后保存；指纹变化时发出高风险警告
- 使用 `@ohos-rs/ssh` 建立真实 SSH 密码认证连接
- 命令终端、命令行独立着色、完整结果与退出状态显示
- 系统概览、CPU/内存、磁盘、网络和失败服务快捷命令
- 密码错误、端口拒绝、DNS、网络超时和指纹问题的中文常驻说明
- 断开连接前二次确认，重新连接后保留当前终端记录
- 主机之间的连接会话相互独立，返回主机列表不会主动断开

## 当前终端方式

鸿蒙三方仓的 `@ohos-rs/ssh` 0.0.1 当前公开接口支持密码/密钥认证和 `exec` 命令执行，但没有公开 PTY Shell、流式通道或 SFTP 接口。因此这个版本采用“一次执行一条命令”的真实 SSH 命令终端：适合系统查询、日志读取、服务管理和脚本执行，不适合 `vim`、`top`、`less` 等需要持续交互或全屏绘制的程序。

后续要实现与桌面版相同的完整交互终端，需要为 HarmonyOS 移植 libssh2/libssh 的 PTY、SFTP 和通道接口，通过 N-API 暴露给 ArkTS，再接入原生终端渲染组件。

## 开发环境

当前 Mac 尚未安装 DevEco Studio 和 HarmonyOS SDK，因此仓库已经完成工程与业务代码，但还需要在 DevEco Studio 中进行首次 SDK 同步、签名和真机编译。

建议环境：

- 最新稳定版 DevEco Studio
- HarmonyOS NEXT SDK API 12 或更高版本
- `ohpm`（DevEco Studio 会一并安装）
- ARM64 HarmonyOS NEXT 手机，或 x86_64 模拟器

## 打开和构建

1. 启动 DevEco Studio，选择 **Open Project**。
2. 打开仓库中的 `harmony` 目录，不要打开整个桌面项目目录。
3. 等待 DevEco Studio 同步 SDK，并执行 `ohpm install` 安装 `@ohos-rs/ssh`。
4. 在 **File → Project Structure → Signing Configs** 中开启自动签名或配置调试证书。
5. 选择 `entry` 模块和手机/模拟器，点击运行。

也可在 DevEco Studio 自带终端执行：

```bash
ohpm install
hvigorw assembleHap --mode module -p product=default -p module=entry@default -p buildMode=debug
```

通常生成的 HAP 位于：

```text
entry/build/default/outputs/default/
```

## 安全说明

- 密码保存在 Asset Store Kit 中，设置为设备首次解锁后可访问，并与应用沙箱绑定。
- 服务器普通资料存放在应用 Preferences 中，不包含密码明文。
- 服务器指纹首次连接时必须由用户确认，后续不一致会再次警告。
- 删除服务器会同步删除其密码关键资产。
- `@ohos-rs/ssh` 是 MIT 许可的第三方库；发布前仍需在目标真机上验证服务器算法兼容性和完成依赖合规检查。
