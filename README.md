# QBO 批量导入助手（浏览器插件）

Chrome Manifest V3 扩展：在当前页面点击插件图标后，于网页右侧打开操作区，多选本地文件，并按「导入 → 保存 → 下一个」的顺序自动处理；成功后标记完成，异常时展示错误。

## 功能

- 点击扩展图标，在页面右侧展开操作面板
- 多选本地文件，并在面板中展示列表
- 点击「开始导入」后逐个文件执行：
  1. 点击页面「导入」按钮（选择器占位）
  2. 将当前文件写入页面 `file` 输入框（选择器占位）
  3. 点击「保存」按钮（选择器占位）
  4. 等待成功提示；成功则标记该文件完成，再处理下一个
- 过程中可「停止」；失败时在面板展示错误信息并中止后续文件
- 执行任务时为网页叠加氛围层、扫描光带、顶部进度浮层，并对当前操作按钮做聚光高亮；成功/失败有瞬时反馈动画

## 目录

```
manifest.json
icons/
src/
  background.js   # 点击图标注入脚本
  selectors.js    # ★ 页面元素选择器占位（你后续只需改这里）
  dom.js          # DOM 等待 / 点击 / 写文件
  effects.js      # 执行中的页面特效
  workflow.js     # 逐个导入流程
  content.js      # 右侧面板 UI 与状态
  panel.css       # 面板与特效样式
demo/
  index.html      # 本地模拟页（不依赖真实 QBO）
```

## 安装（Chrome）

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本仓库根目录（含 `manifest.json` 的目录）

## 本地演示（不装扩展也可看面板）

用任意静态服务器打开 demo，例如：

```bash
cd qbo-import-extension
npx --yes serve .
```

浏览器访问 `/demo/`，点右下角「打开导入助手」。页面上的导入/保存按钮已用与插件相同的 `data-qbo-import` 占位属性，可完整跑通流程。

## 接入真实 QBO 页面

打开 `src/selectors.js`，把占位选择器换成你提供的真实元素，例如：

```js
root.SELECTORS = {
  importButton: '...',      // 导入按钮
  fileInput: 'input[type="file"]', // 文件输入框
  saveButton: '...',        // 保存按钮
  successIndicator: '...',  // 保存成功提示
  errorIndicator: '...',    // 错误提示（可选）
};
```

`TIMEOUTS` 可按页面响应速度调整。

## 说明

- 当前未绑定团队 GitHub 远程仓库；本目录已初始化 git。你可在 GitHub 新建空仓库后执行：

```bash
git remote add origin <你的仓库地址>
git push -u origin cursor/qbo-import-extension-a88c
```

- 扩展需要在目标页面有权限才能注入；默认允许 `*.intuit.com`。若 QBO 域名不同，请改 `manifest.json` 的 `host_permissions`。
