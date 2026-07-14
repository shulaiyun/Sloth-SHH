# SlothSSH Android

SlothSSH 的原生 Android 客户端，适用于 Android 8.0（API 26）及以上设备。

## 当前功能

- 管理、搜索、收藏、编辑和删除服务器
- 使用 Android Keystore 对服务器密码进行 AES-GCM 加密
- SSH 密码及键盘交互式认证
- 首次连接服务器时核对并保存主机指纹
- 可输入命令的真实交互式 Shell，支持 Ctrl+C、Tab、Esc 和方向键
- 同时保持多台服务器、多个终端会话，返回主机列表不会断线
- 复制 SSH 命令、粘贴剪贴板、清理本地终端显示
- 中文/英文切换、日间/夜间主题
- 对密码错误、超时、DNS、端口拒绝和主机指纹错误提供常驻中文说明

## 安装

手机需要允许当前文件管理器或浏览器“安装未知应用”，然后打开 APK 安装。APK 不包含本机动态库，因此同一个安装包可用于常见的 ARM、ARM64、x86 和 x86_64 Android 设备。

## 本地构建

```bash
cd android
export ANDROID_HOME=/path/to/android-sdk
./gradlew assembleDebug
```

输出位于 `app/build/outputs/apk/debug/app-debug.apk`。

## 安全说明

服务器密码只保存在应用私有存储中，密钥由 Android Keystore 生成且不可导出；应用同时禁用了系统备份和设备迁移中的应用数据复制。卸载应用会删除保存的主机资料和密钥。

当前版本的终端适合常规 Shell 命令和运维输出。`vim`、`top` 等依赖完整屏幕光标控制的 TUI 程序将在后续版本接入完整 xterm 渲染器；服务器文件管理、资源监控和终端翻译也会作为移动端后续模块继续迁移。
