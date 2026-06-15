# fnchess 重构开发路径

架构基准：[CONTEXT.md](../CONTEXT.md) · [ADR 0001](adr/0001-four-layer-architecture.md)

**原则：每一阶段结束时游戏必须可运行。**

---

## 进度总览

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0 | 工具层净化 | ✅ 完成 |
| P1 | 纯逻辑 Domain 模块 | ✅ 完成 |
| P2 | 独立 DOM Domain 模块 | ✅ 完成 |
| P3 | 核心游戏状态模块 | ✅ 完成 |
| P4 | 渲染管线 | ✅ 完成 |
| P5 | 表达式构建器 | ✅ 完成 |
| P6 | AI + 网络 | ✅ 完成 |
| P7 | 模式层 | 📝 文件已写，未接入 |
| P8 | 顶层收口 | 📝 文件已写，未接入 |
| P9 | 文件行数合规拆分 | 📝 View 文件已提取，UIController 未删旧代码 |
| P10 | 新架构接入与旧代码清除 | ⬜ 未开始 |

状态标记：⬜ 未开始 · 🔄 进行中 · ✅ 完成 · ⏸ 暂停 · 📝 文件已写，未接入

---

## P0 · 工具层净化

**目标**：不改任何行为，只确立工具层边界。

### 任务

- [x] **P0-1** GridSystem 瘦身
  - 移除 `targetCells`、`forbiddenCells`、`usedCells`、`functionHistory` 字段
  - 保留：`canvas`、`ctx`、`range`、`gridSize`、`cellSize`、坐标变换方法、`draw()`（暂时接收外部状态参数）
  - 验证：网格能正常绘制，坐标变换正确

- [x] **P0-2** FunctionParser 独立性确认
  - 确认 FunctionParser 不依赖任何游戏状态
  - 移除 `lockedElements` 字段（锁定状态属于 ExpressionModule，不属于 Parser）

- [x] **P0-3** 工具层目录整理
  - 新建 `js/tools/` 目录
  - 将工具类移入（GridSystem、FunctionParser、BitStream、BitmapCodec、HybridMapCodec、SeedCrypto）

**完成标准**：工具层文件不 import 任何 Domain 层内容；游戏可运行。

---

## P1 · 纯逻辑 Domain 模块

**目标**：提取没有 DOM 依赖的纯业务逻辑模块。

### 任务

- [x] **P1-1** ScoringModule
  - 从 `GameController.evaluateResult()` 和 `function-complexity-analyzer.js` 提取
  - Model/BusinessService：`evaluate(hitTargets, hitForbidden, expression) → score`
  - ViewModel：发出 `scoreChanged`、`evaluationComplete` 事件
  - View：暂无（得分显示后续归入 RoundModule.View）
  - Controller：暴露 `evaluate()` 接口

**完成标准**：ScoringModule 可独立测试；GameController 的计分逻辑委托给 ScoringModule。

---

## P2 · 独立 DOM Domain 模块

**目标**：提取有独立 DOM 区域、对其他游戏模块依赖少的模块。

### 任务

- [x] **P2-1** AudioModule
  - 从 `AudioManager.js` 提取
  - LifecycleService：init（加载音频资源）、destroy（停止播放）
  - BusinessService：`playBgm()`、`playSfx(event)`、音效事件映射表
  - View：`#bgm-modal` 弹窗（音量设置）
  - 移除 `window.audioManager` 全局引用

- [x] **P2-2** CharacterModule
  - 从 `SummaCharacter.js`、`SummaAnimator.js` 提取
  - BusinessService：情绪状态机、对话队列
  - View：`#summa-container`
  - Controller：暴露 `setEmotion(emotion)`、`showDialog(text)` 接口
  - 移除 `window.summaCharacter` 全局引用

**完成标准**：BGM 正常播放；Summa 角色动画正常；各模块 DOM 区域独立。

---

## P3 · 核心游戏状态模块

**目标**：拆解 GameController 的核心状态，建立 BoardModule 和 RoundModule。

### 任务

- [x] **P3-1** BoardModule
  - 接收从 GridSystem 移出的 `targetCells`、`forbiddenCells`、`usedCells`
  - BusinessService：`selectTarget(cell)`、`addForbidden(cell)`、`confirmSelection()`、`reset()`
  - ViewModel：发出 `boardChanged` 事件，提供 `getBoardSnapshot()` 供 RenderModule 使用
  - View：无（棋盘绘制由 RenderModule 执行）

- [x] **P3-2** RoundModule
  - 从 `GameController` 提取阶段状态机、计时器、回合历史
  - BusinessService：`advancePhase()`、`handleTimeout()`、`switchPlayer()`、`reset()`
  - ViewModel：发出 `phaseChanged`、`timerUpdate`、`roundComplete` 事件
  - View：`#timer`、`#current-player`、`#phase-hint`、`#current-round`、`#total-rounds`

- [x] **P3-3** GameController 降级
  - GameController 保留为临时胶水层，内部委托给 BoardModule、RoundModule、ScoringModule
  - 标记为待删除

**完成标准**：所有游戏模式可运行；`#timer` 由 RoundModule.View 更新。

---

## P4 · 渲染管线

**目标**：建立 RenderModule，成为 Canvas 唯一写入者。

⚠️ **高风险阶段**：Canvas 绘制顺序（格子在下、曲线在上）必须在此阶段保证正确。

### 任务

- [x] **P4-1** RenderModule 骨架
  - 整合 FunctionRenderer、CollisionDetector
  - 新增 `drawBoard(boardSnapshot)` 接口（接收 BoardModule 的纯数据）
  - 确立绘制顺序：清屏 → 绘坐标网格 → 绘历史曲线（淡化）→ 绘棋盘格子 → 绘当前曲线
  - LifecycleService：init（绑定 canvas）、destroy（取消动画帧）

- [x] **P4-2** functionHistory 迁移
  - 从 GridSystem 移入 RenderModule.Model
  - BusinessService：`addToHistory(expression, color)`、`clearHistory()`

- [x] **P4-3** GridSystem.draw() 替换
  - 所有调用 `gridSystem.draw()` 的地方改为 `renderModule.redraw(boardSnapshot)`
  - GridSystem 的 `draw()` 方法保留为内部调用，不对外暴露

**完成标准**：所有模式下曲线绘制、格子绘制、历史淡化正常；碰撞检测结果正确。

---

## P5 · 表达式构建器

**目标**：从 UIController 提取 ExpressionModule。

### 任务

- [x] **P5-1** ExpressionModule
  - 从 UIController 提取拖拽状态、光标插入、表达式字符串管理
  - BusinessService：`insertElement(el, pos)`、`clear()`、`submit()` → 触发回调
  - ViewModel：发出 `expressionChanged`、`submitted` 事件
  - View：底部元素面板 + `#expression-display`
  - Delegate（注入）：FunctionParser（元素分类）、RenderModule（实时预览）

- [x] **P5-2** 锁定元素显示
  - ExpressionModule.View 订阅 RoundModule 的 `lockedElementsChanged` 事件，更新元素面板禁用状态
  - 不直接读 RoundModule 状态，通过事件驱动

**完成标准**：表达式构建、实时预览、锁定显示正常；ExpressionModule 不依赖 UIController。

---

## P6 · AI + 网络

**目标**：提取 AIModule 和 NetworkModule。

### 任务

- [x] **P6-1** AIModule
  - 从 AIController 提取，内部包含 DevService（SummaTrainer）
  - BusinessService：`playTurn(phase)` → 返回操作结果
  - LifecycleService：init（加载学习数据）、destroy（保存学习数据）
  - Controller：暴露 `playTurn()`、`startTraining(config)`、`stopTraining()` 接口

- [x] **P6-2** NetworkModule
  - 从 P2PController 提取（当前已经相对独立）
  - LifecycleService：destroy（断开连接、清理心跳）
  - Controller：暴露 `createRoom()`、`joinRoom(code)`、`sendAction(action, payload, rollback)`

**完成标准**：AI 对战可运行；P2P 联机可运行。

---

## P7 · 模式层

**目标**：为每种游戏模式建立独立模块，消除 UIController 的模式分支。

顺序：LocalMode（最简）→ TestMode → CampaignMode → AIMode → P2PMode（最复杂）

### 任务

- [x] **P7-1** LocalMode（文件已创建）
- [x] **P7-2** TestMode（文件已创建）
- [x] **P7-3** CampaignMode（文件已创建）
- [x] **P7-4** AIMode（文件已创建）
- [x] **P7-5** P2PMode（文件已创建）

> ⚠️ **实际状态**：5 个 Mode 文件均存在，但均未在 `index.html` 中加载，游戏仍走 UIController 旧路径。
> 完成标准中"UIController 中对应的模式分支代码被删除"**尚未执行**。
> 本阶段的真正完成依赖 P10。

---

## P8 · 顶层收口

**目标**：建立 AppController，清理所有全局变量和遗留代码。

### 任务

- [x] **P8-1** AppController（文件已创建）
- [x] **P8-2** AppView（文件已创建）
- [ ] **P8-3** 清理（未执行）
  - 全局调试接口集中到 `window.app.debug`，旧全局引用标注 `@deprecated`
  - AIMode 训练对话框逻辑从 UIController 迁移到 `AIMode.prepareGame()`
  - 各 Mode 类加入 `start()` 钩子，`handleStart` 改为统一分发

> ⚠️ **实际状态**：AppController / AppView 文件已创建，但均未在 `index.html` 中加载。
> 游戏入口仍为 `new UIController(gridSystem, gameController)`。
> 本阶段的真正完成依赖 P10。

---

## P9 · 文件行数合规拆分

**目标**：所有文件代码行数 ≤500；职责边界清晰，拒绝耦合。

**原则：每个子任务完成后游戏必须可运行。**

| 阶段 | 内容 | 状态 |
|------|------|------|
| P9-1 | GridSystem.js 拆分 | ✅ 完成 |
| P9-2 | GameController.js 拆分 | ✅ 完成 |
| P9-3 | UIController.js 拆分 | 📝 View 文件已提取，UIController 旧代码未删除 |

### P9-1 · GridSystem.js（806行 → 2个文件）

- [x] **P9-1-1** 提取 `GridRenderer.js`（189行）；GridSystem.js 压缩至239行
- [x] **P9-1-2** 删除 `extendFunctionPoints / evaluateExpression`
- [x] **P9-1-3** 更新 `files/index.html` 的 script 标签

### P9-2 · GameController.js（1134行 → 4个文件）

- [x] **P9-2-1** 提取 `RoundStateMachine.js`（161行）
- [x] **P9-2-2** 提取 `GameTimer.js`（103行）
- [x] **P9-2-3** 提取 `GameHistoryService.js`（86行）
- [x] **P9-2-4** GameController.js 压缩至246行（从1139行）

### P9-3 · UIController.js（4891行 → 多文件）

- [x] **P9-3-1** 提取 `ModalService.js`（76行）
- [x] **P9-3-2** 提取 `StartMenuView.js`（171行）
- [x] **P9-3-3** 提取 `ExpressionView.js`（140行）
- [x] **P9-3-4** 提取 `CanvasInteractionView.js`（66行）
- [x] **P9-3-5** 提取 `TestModeView.js`（126行）
- [x] **P9-3-6** 提取 `CampaignView.js`（143行）
- [x] **P9-3-7** 提取 `P2PView.js`（115行）
- [x] **P9-3-8** 提取 `GameFlowView.js`（141行）；提取 `GameEventView.js`（351行）
- [ ] **P9-3-9** UIController.js 删除已提取代码，压缩至 ≤500 行
  - 当前实际行数：**4892 行**（提取的 View 文件从未 wire 进去，旧代码从未删除）
  - 11 个 View 文件全部为 untracked 状态，未加载到 index.html

> ⚠️ **实际状态**：P9-3 所有 View 文件已创建但悬空，UIController 仍为 4892 行原始状态。
> 本阶段的真正完成依赖 P10-3（View 文件接入 + UIController 清理）。

---

## P10 · 新架构接入与旧代码清除

**目标**：将 P7/P8/P9 产出的所有悬空文件真正接入游戏，游戏切换到新架构运行，删除旧代码。

**前提**：每一步完成后游戏必须可运行，不可同时推进多步。

### 任务

- [ ] **P10-1** 验证 AppController 实现完整性
  - 读取 `AppController.js`，确认它能持有所有 Domain 单例、管理 Mode 切换
  - 确认 `AppView.js` 能接管开始界面逻辑
  - 产出：清单列出缺失的接口或依赖，决定是否需要补写

- [ ] **P10-2** 补全 index.html script 加载顺序
  - 按依赖顺序添加所有缺失的 `<script>` 标签：
    - 工具层：`GridRenderer.js`
    - Domain 全量：`RenderModule.js`、`RoundModule.js`、`ExpressionModule.js`、`AIModule.js`、`NetworkModule.js`
    - GameController 拆出文件：`RoundStateMachine.js`、`GameTimer.js`、`GameHistoryService.js`
    - Mode 层：`ModeBase.js`、`LocalMode.js`、`TestMode.js`、`CampaignMode.js`、`AIMode.js`、`P2PMode.js`
    - View 层（11个）：`ModalService.js`、`StartMenuView.js`、`ExpressionView.js`、`CanvasInteractionView.js`、`TestModeView.js`、`CampaignView.js`、`P2PView.js`、`GameFlowView.js`、`GameActionView.js`、`GameEventView.js`
    - 顶层：`AppView.js`、`AppController.js`
  - 验证：页面无 JS 报错，游戏可加载

- [ ] **P10-3** 切换初始化入口
  - 将 index.html 的 `DOMContentLoaded` 初始化代码替换为 `new AppController()`
  - 保留旧代码为注释块（回滚备用）
  - 验证：本地对战模式可完整运行一局

- [ ] **P10-4** 逐模式回归验证
  - [ ] LocalMode：两人本地对战完整一局
  - [ ] AIMode：人机对战完整一局
  - [ ] CampaignMode：闯关选关、通关流程
  - [ ] TestMode：测试模式基本功能
  - [ ] P2PMode：建房、加入房间、完整一局（需两端）

- [ ] **P10-5** UIController 旧代码清除
  - 删除已由 View 文件接管的所有代码段
  - 目标：UIController.js ≤ 500 行（纯委托存根 + 无法归属的胶水代码）
  - 验证：清除后游戏全部模式可运行

- [ ] **P10-6** 提交所有悬空文件
  - `git add` 全部 untracked 的 View/Mode/Domain 文件
  - 一次性提交，commit message 说明"接入新架构"

**完成标准**：
- `index.html` 初始化入口为 `new AppController()`
- UIController.js ≤ 500 行
- 所有 5 种游戏模式回归通过
- 无 untracked 的架构文件

---

## 决策日志

| 日期 | 决策 | 依据 |
|------|------|------|
| 2026-06-14 | 四层架构确立 | ADR 0001 |
| 2026-06-14 | Domain 模块为单例，切换时 reset 不销毁 | Canvas/AI学习数据不可重建 |
| 2026-06-14 | ViewModel 发 EventEmitter 事件，View 订阅 | ViewModel 不持有 DOM |
| 2026-06-14 | RenderModule 为 Canvas 唯一写入者 | 保证绘制顺序 |
| 2026-06-14 | CharacterModule 加 react*/setLookMode 别名方法 | SummaCharacter API 兼容 |
| 2026-06-14 | CharacterModule.init 移到 UIController 创建之后 | summaCharacter 由 UIController 构造时创建 |
| 2026-06-14 | roundModule.timeout 调用 gameController.handleTimeout | 超时后阶段必须推进 |
| 2026-06-14 | updatePhaseUI AI输入阶段禁用玩家操作 | AI回合玩家不可干预 |
| 2026-06-14 | 提取 `_isAITurn()` 辅助方法，替换11处重复判断 | 消除 AI 回合判断重复代码 |
| 2026-06-14 | `selectMode` 用配置表重构，从125行压缩到50行 | 消除7个重复 if-else 分支 |
| 2026-06-14 | P7/P8/P9-3 产出文件悬空，游戏仍走旧架构 | 代码审查发现 index.html 未加载新文件 |

---

## 注意事项

- **不要同时重构多个模块**：每次只推进一个任务，完成后验证游戏可运行再继续
- **保留旧代码到模块稳定**：新模块建立后，旧代码先保留为降级胶水，验证通过再删除
- **P4 渲染管线是最高风险点**：建议在独立分支上完成，合并前做完整回归测试
- **P10 接入是当前最高优先级**：不接入则 P7/P8/P9 的所有工作均未生效
