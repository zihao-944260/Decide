# 云函数构建与部署

技术方案 §6.6 的落地目录约定。§6.6 里写的 `--remote-npm-install`（依赖在云端安装）**只上传函数目录内的文件**，
所以业务函数不能再依赖 `"common": "file:../common"`（云端拿不到 `../common`，安装必然失败）。
现在改成：`common` 以源码形式在本地被 esbuild 内联，云端只需安装 `wx-server-sdk`。

## 一条命令

```bash
npm run build:cloud          # 仓库根执行；不碰 git，不执行任何部署
```

脚本：`scripts/build-cloud.mjs`（纯 node + 仓库已有 esbuild 0.20.2，无新增依赖）。步骤：
清空 `dist-cloud/` → `tsc --noEmit` 检查 common 与 5 个函数（任一失败即中止，退出码 1）→
逐函数 esbuild（`--bundle --platform=node --target=node16 --format=cjs --external:wx-server-sdk
--alias:common=cloudfunctions/common/src/index.ts`）→ 拷贝 `config.json`、生成部署用 `package.json` →
自检（bundle 内 `require("common")` 必须 0 命中 + `node --check`）→ 打印体积。

## 产物目录（gitignore，勿手改）

```
dist-cloud/<fn>/
  index.js       bundle（common 已内联）
  config.json    从 cloudfunctions/<fn>/config.json 原样拷贝（timeout / scheduler 的两个 timer 不变）
  package.json   main: index.js + 仅 wx-server-sdk ^4.0.2，不含 file:../common
```

## 部署（主 agent 执行，本脚本不做）

对 `dist-cloud/<fn>/` 目录逐个上传，依赖仍走云端安装（`--paths` 换成产物目录即可，其余参数与 §6.6 一致）：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env cloud1-d2g9acyyhb220d834 \
  --paths <绝对路径>/dist-cloud/<fn> \
  --remote-npm-install \
  --project <绝对路径>/dist/build/mp-weixin
```

首次部署函数不存在时会报 `FailedOperation.UpdateFunctionCode：当前函数处于 Creating 状态`，原样重试一次即成功；
`timeout` 仍需控制台设置（CLI 不生效）。

## 类型检查

`cloudfunctions/<fn>/tsconfig.json` 的 `paths` 指向 `../common/src/index.ts`（读源码，不再依赖任何编译产物）。
因 `common` 源码在函数目录之外，`rootDir` 相应改为 `"../"`；函数侧不再有带 emit 的 `build` 脚本，
只允许 `tsc -p tsconfig.json`。`cloudfunctions/common/` 下不再保留 `*.js` / `*.d.ts`。
**主 agent 收尾**：6 个 tsconfig 把 `"outDir": "."` 换成 `"noEmit": true`（common 另删 `declaration`），
`common/package.json` 的 emit 型 `build` 脚本一并删除。防的就是有人手滑跑一次不带 `--noEmit` 的 `tsc -p`，
把 JS 吐回函数目录——`cloudfunctions/user/` 那批残留就是这么来的。

## 产物治理（主 agent 收尾）

`cloudfunctions/user/index.js` 与 `cloudfunctions/user/handlers/*.js` 是旧 per-function emit 的残留，已删除（删除前后各跑一次
`npm run build:cloud`，5 个 bundle md5 全等，证明从未参与构建）。`.gitignore` 相应改成通用规则
`cloudfunctions/*/**/*.js` 与 `.../*.d.ts`——函数源码只有 `.ts`，任何 JS 落进函数目录都视为残留，不再逐个目录点名。
