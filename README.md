# SlothSSH

[![Build Installers](https://github.com/shulaiyun/Sloth-SHH/actions/workflows/build-installers.yml/badge.svg)](https://github.com/shulaiyun/Sloth-SHH/actions/workflows/build-installers.yml)

SlothSSH 是一个偏服务器日常管理的桌面 SSH 客户端，使用 Electron、React、ssh2 和 xterm 构建。

## 功能

- 密码、SSH 私钥认证
- 密码与私钥口令持久化保存
- 使用操作系统安全存储加密凭据
- 随时查看或复制已保存的服务器密码
- 可交互的 SSH 终端、自动尺寸同步和连接保活
- 终端右键复制、粘贴、复制全部、全选与本地清屏
- 全部主机、收藏、最近连接和密钥主机视图
- 主机搜索、备注、分组和颜色标记
- 20 条按系统、资源、网络、服务日志、容器和安全分类的只读运维命令，编辑确认后再运行
- 原位翻译选中内容或全部终端输出，并保持当前阅读位置
- 主界面显示当前翻译接口并提供快速切换入口
- 当前输入命令和终端提示行可显示中文用途说明
- 正常终端和翻译视图都会用独立颜色标记已执行命令
- 选中翻译同时显示英文原文、中文释义，并支持系统语音朗读中英文
- 可配置翻译失败提示等待阈值，红色失败行保留并说明原文
- 本地终端结构化翻译，以及 Google、百度、腾讯云、阿里云机器翻译
- DeepSeek、阿里百炼、智谱、硅基流动、OpenAI 和自定义大模型接口预设
- 可调节终端字号
- macOS / Windows 桌面打包配置

## 运行

```bash
npm install
npm run dev
```

生产构建并启动：

```bash
npm run build
npm start
```

生成安装包：

```bash
npm run dist
```

## GitHub 云端构建

仓库已配置 `Build Installers` 工作流。在 GitHub 仓库打开 **Actions → Build Installers → Run workflow**，即可构建并下载以下文件：

| 平台 | 设备架构 | 输出格式 |
| --- | --- | --- |
| Windows | x64、ARM64、x86 32 位 | NSIS `.exe` |
| macOS | Intel x64、Apple Silicon ARM64 | `.dmg`、`.zip` |
| Linux | x64、ARM64 | `.AppImage`、`.deb` |
| Android 8.0+ | ARM、ARM64、x86、x86_64 通用 | `.apk`、`.aab` |

手动运行产生的文件会在该次 Actions 任务的 **Artifacts** 区域保留 30 天。推送 `v` 开头的版本标签（例如 `v0.1.0`）时，全部平台文件会自动发布到 GitHub Releases。

未配置签名密钥时，Windows、macOS 和 Linux 包可以用于测试；Android 会提供可直接安装的 Debug APK，以及未签名的 Release APK/AAB。正式分发时可在仓库 Secrets 中配置对应平台的签名信息，工作流已经预留以下变量：

- Windows：`WIN_CSC_LINK`、`WIN_CSC_KEY_PASSWORD`
- macOS：`MAC_CSC_LINK`、`MAC_CSC_KEY_PASSWORD`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`
- Android：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`

服务器资料保存在 Electron 的 `userData/hosts.json`，翻译设置保存在 `userData/settings.json`。配置文件权限为 `0600`；服务器密码及接口密钥通过 Electron `safeStorage` 调用系统安全存储进行加密，不以明文写入配置文件。
