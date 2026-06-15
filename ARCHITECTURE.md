# fnchess 架构说明

## 分层总览

```
┌─────────────────────────────────────────────────────────┐
│  App Layer (scripts/ui/AppController.js, AppView.js)    │
│  唯一入口，持有所有 Domain 单例，管理模式生命周期            │
├─────────────────────────────────────────────────────────┤
│  Mode Layer (scripts/modes/)                             │
│  LocalMode / AIMode / CampaignMode / P2PMode / TestMode  │
│  每个模式定义独立的回调链，封装完整业务逻辑                   │
├─────────────────────────────────────────────────────────┤
│  Domain Layer (scripts/domain/)                          │
│  Board / Round / Render / Expression / Audio / Character │
│  AI / Network / Scoring / CampaignStorage                │
│  按功能域划分的有状态模块，模块间不直接调用                    │
├─────────────────────────────────────────────────────────┤
│  Core Layer (scripts/core/)                              │
│  GameController / RoundStateMachine / GameTimer           │
│  GameHistoryService / P2PController                      │
│  游戏核心状态与规则引擎                                     │
├─────────────────────────────────────────────────────────┤
│  AI Layer (scripts/ai/)                                  │
│  AIController / AIFunctionBuilder / AITargetSelector      │
│  AILearningSystem / SummaTrainer                         │
│  AI 决策与训练子系统                                       │
├─────────────────────────────────────────────────────────┤
│  UI Layer (scripts/ui/)                                  │
│  UIController + 14 个 View 类 + AppController            │
│  DOM 交互、Canvas 事件、模态框管理                          │
├─────────────────────────────────────────────────────────┤
│  Render Layer (scripts/render/)                          │
│  FunctionRenderer / DrawEngine / PointSampler             │
│  CollisionDetector                                       │
│  函数曲线采样、绘制、碰撞检测                                │
├─────────────────────────────────────────────────────────┤
│  Tool Layer (scripts/tools/ + geogebra-lite/)             │
│  GridSystem / FunctionParser / SeedCrypto / CurvePlotter  │
│  无状态纯工具，不持有游戏状态，不知道游戏规则                  │
└─────────────────────────────────────────────────────────┘
```

## 初始化链路

```
DOMContentLoaded
  │
  ├─ new GridSystem('game-canvas')        ← 工具层：棋盘网格
  ├─ new GameController()                 ← Core：游戏状态机
  ├─ new UIController(gridSystem, gc)     ← UI 总控
  │   ├─ new FunctionRenderer(gridSystem) ← 渲染引擎
  │   ├─ new CollisionDetector(gridSystem)← 碰撞检测
  │   ├─ new AIController(gc, gridSystem) ← AI 控制器
  │   ├─ new SummaCharacter(container)    ← 角色动画
  │   ├─ new RandomChallengeMode(...)     ← 随机关卡模式
  │   └─ 14 个 View 实例化               ← 各 UI 视图
  │
  ├─ Domain Module 初始化（window 全局挂载）
  │   ├─ AudioModule.init(audioManager)
  │   ├─ BoardModule.init()
  │   ├─ CharacterModule.init(summaCharacter)
  │   ├─ RenderModule.init(gridSystem, renderer, detector)
  │   ├─ RoundModule.init()
  │   └─ ExpressionModule.init()
  │
  ├─ SummaTrainer 初始化
  ├─ AIModule.init(aiController, summaTrainer)
  ├─ NetworkModule.init(p2pController)
  │
  ├─ Mode 层实例化（5 个模式）
  │
  ├─ new AppController().init()           ← 顶层：绑定所有模块引用
  └─ new AppView().init(app, uiController)← 顶层视图
```

## Core 层：游戏核心

### GameController（胶水层）

过渡期胶水层，内部委托给三个服务：
- **RoundStateMachine** — 阶段流转 + 回合操作
- **GameTimer** — 倒计时与超时处理
- **GameHistoryService** — 回合历史记录与游戏报告

对外暴露 EventBus（`on`/`emit`），UI 层通过事件订阅响应状态变化。

### 回合阶段流转

```
SELECT_TARGET  →  SET_FORBIDDEN  →  SET_LOCKS  →  INPUT_FUNCTION
                                                      │
                                                 ┌────┘
                                                 ▼
SWITCH_PLAYER  ←  EVALUATE  ←  (提交函数)
     │
     ├─ currentRound++ ；若 > totalRounds → END
     └─ 切换 currentPlayer，回到 SELECT_TARGET
```

关键约束：
- `SET_FORBIDDEN`：maxForbiddenCount = 0 时自动跳过
- `SET_LOCKS`：maxLockCount = 0 时自动跳过
- `INPUT_FUNCTION`：测试/闯关模式下 currentPlayer 不切换
- `SWITCH_PLAYER`：提交 usedCells 历史后推进回合

### 回合评估

```
submitFunction(expr)
  → setPhase(EVALUATE)
  → UIController.renderAndEvaluate(expr)
     ├─ prepareRenderCanvas()           ← 清空画布，绘制网格
     ├─ renderer.drawFunction(expr)     ← 渲染函数曲线
     ├─ renderer.sampleFunction()       ← 采样碰撞点
     ├─ detector.checkHitTarget()       ← 检测命中目标格
     ├─ detector.checkHitForbidden()    ← 检测命中禁格
     └─ gc.evaluateResult(...)          ← 计分，emit 事件
```

## Mode 层：模式系统

### ModeBase 基类

```javascript
class ModeBase {
    setup(config)     // 模式启动（AppController 调用）
    teardown()        // 模式销毁
    onTargetConfirmed(roundState)    // 回调链钩子
    onForbiddenConfirmed(roundState)
    onLocksConfirmed(roundState)
    onFunctionSubmitted(expression)  // 核心：渲染→碰撞→计分
    on(event, fn)     // EventEmitter
}
```

### 各模式回调链差异

| 阶段 | LocalMode | AIMode | CampaignMode | P2PMode |
|------|-----------|--------|--------------|---------|
| 目标确认 | 直接推进 | 直接推进 | 直接推进 | P2P 同步 + 推进 |
| 禁区确认 | 直接推进 | 直接推进 | 直接推进 | P2P 同步 + 推进 |
| 锁定确认 | 直接推进 | 直接推进 | 直接推进 | P2P 同步 + 推进 |
| 函数提交 | 渲染→碰撞→计分 | 渲染→碰撞→计分→触发AI | 渲染→碰撞→关卡判定 | P2P 同步→渲染→碰撞→计分 |

### 特殊模式

- **TestMode**：无目标格/禁区，自由绘制函数，`difficulty === 'test'`
- **RandomChallengeMode**：两个子模式（随机挑战、关卡验证），内含 LevelEditorExtension
- **LevelEditorExtension**：编辑/验证双模式，独立滚轮缩放生命周期

## 事件系统

GameController 作为事件总线，关键事件：

```
gameInit          → UI 初始化回合显示、计时器
phaseChange       → UI 更新阶段提示、按钮状态
targetSelected    → Canvas 高亮目标格
targetRemoved     → Canvas 取消高亮
forbiddenAdded    → Canvas 标记禁格
forbiddenRemoved  → Canvas 取消禁格
elementLocked     → 元素面板更新锁定状态
timerUpdate       → 计时器数字更新
timeout           → 超时扣分
evaluationComplete→ 显示命中结果、得分动画
roundComplete     → 回合推进、分数更新
gameEnd           → 弹出游戏结束模态框
campaignLevelResult → 闯关结果（通过/失败）
```

## Domain 层：功能域模块

模块间**不直接调用**，通过 Mode 层回调链协调。

| 模块 | 职责 | 对外接口 |
|------|------|----------|
| BoardModule | 格子状态（target/forbidden/used） | `drawBoard()`, `resetAll()`, `commitRoundToHistory()` |
| RenderModule | Canvas 唯一写入者 | `draw()`, `drawBoard()`, `clearHistory()` |
| RoundModule | 阶段状态 + 计时器 | `startGame()`, `startTimerFor()`, `stopTimer()` |
| ExpressionModule | 表达式构建器状态 | `clear()`, 当前表达式 |
| AudioModule | BGM/音效 | `init()`, `playClick()`, volume control |
| CharacterModule | Summa 角色动画 | `init()`, `setEmotion()` |
| AIModule | AI 学习/训练 | `init()` |
| NetworkModule | P2P 连接 | `init()`, `send()`, `onMessage()` |
| ScoringModule | 计分规则 | `evaluate()` |
| CampaignStorage | 闯关进度持久化 | `getClearedMax()`, `setClearedMax()` |

数据流方向：**Mode → Domain（通过 AppController 持有的引用读写 Domain 模块状态）**。

## 文件组织

```
fnchess/
├── index.html                    ← 唯一入口
├── scripts/
│   ├── tools/     (13 files)     ← 无状态工具：GridSystem, FunctionParser, 编码/加密, auto-solver
│   ├── render/    (4 files)      ← Canvas 渲染：PointSampler → DrawEngine → FunctionRenderer, CollisionDetector
│   ├── domain/    (10 files)     ← 功能模块：Board, Render, Round, Expression, Audio, Character, AI, Network, Scoring, CampaignStorage
│   ├── core/      (5 files)      ← GameController, RoundStateMachine, GameTimer, GameHistoryService, P2PController
│   ├── ai/        (11 files)     ← AIController, FunctionBuilder(s), TargetSelector, LearningSystem, SummaTrainer
│   ├── modes/     (6 files)      ← ModeBase, LocalMode, AIMode, CampaignMode, P2PMode, TestMode
│   └── ui/        (19 files)     ← UIController, AppController, AppView, 14 View 类, RandomChallengeUI, LevelEditorExtension, LevelEditorUI
├── assets/                        ← 图片/音效/BGM/字体/角色
├── styles/                        ← CSS
└── geogebra-lite/                 ← 第三方采样库（CurvePlotter 等 12 个文件）
```

## 设计原则

1. **单向依赖**：上层依赖下层，下层不感知上层（tools ← render ← domain ← core ← modes ← ui ← app）
2. **事件驱动**：GameController 作为事件总线，UI 层订阅事件；Domain 模块不互相调用
3. **Mode 隔离**：每个模式拥有独立的回调链，模式切换时先 `teardown()` 再 `setup()`
4. **Canvas 单一写入者**：RenderModule 是 Canvas 的唯一写入者，外部通过 `draw()` / `drawBoard()` 接口传入纯数据
5. **每文件 ≤ 500 行**：超出必须拆分为独立类
6. **模块结构**：Controller → Model(BusinessService + LifecycleService) → ViewModel → View
