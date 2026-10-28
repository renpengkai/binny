# 纸篓猫

一只住在桌面上的码猫，顺手帮你收拾废纸篓。表情来自 [mkdown-site](https://github.com/gggaiitx/mkdown-site) 的码猫素材，不占程序坞，菜单栏留一个猫图标。

## 互动

- 把文件或文件夹拖到它身上：换惊吓脸，移进系统废纸篓，可以在访达里撤销
- 拖动身体：搬家，位置会记住
- 单击：跳一下，有时会喵
- 双击：打开废纸篓
- 右键，或点菜单栏图标：找回、打开、清空、声音、是否浮在窗口上面、登录时打开、退出
- 放着不管一会儿会打瞌睡；悬停会举爪打招呼

清空会永久删除，操作前有确认。第一次清空需要在系统设置里允许「纸篓」控制「访达」。

## 系统要求

macOS 13 及以上。不需要安装 Xcode。

## 安装

从 [Releases](https://github.com/renpengkai/binny/releases) 下载 `Binny-x.y.z.zip`，解压后把 `Binny.app` 放进「应用程序」。

应用为 ad-hoc 签名，首次打开前可去掉隔离属性：

```bash
xattr -cr /Applications/Binny.app
```

## 构建

```bash
bash scripts/package-app.sh
open dist/Binny.app
```

推送到 `main` 会在 GitHub Actions 里打包产物；推送 `v*` 标签会同时发 Release。

登录时打开只对放进「应用程序」的这份生效。

## 素材致谢

表情图来自 [gggaiitx/mkdown-site](https://github.com/gggaiitx/mkdown-site) 的码猫。
