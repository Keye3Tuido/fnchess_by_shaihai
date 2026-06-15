# ADR 0001: Four-Layer Architecture with MVVM + Service + Delegate

Date: 2026-06-14  
Status: Accepted

## Context

fnchess 现有代码的核心问题：UIController 承担了所有层的职责（248 处跨域引用），五种游戏模式的业务逻辑混在同一个对象里，Canvas 渲染状态和游戏状态耦合在 GridSystem 中，模式切换没有明确的生命周期边界导致状态残留。

## Decision

采用四层架构，每层职责严格隔离：

### 层次结构

```
Tool Layer      GridSystem / geogebra-lite / FunctionParser / BitStream / BitmapCodec / HybridMapCodec / SeedCrypto
Domain Layer    BoardModule / RoundModule / ScoringModule / AIModule / NetworkModule /
                RenderModule / ExpressionModule / CharacterModule / AudioModule
Mode Layer      LocalMode / AIMode / CampaignMode / P2PMode / TestMode
App Layer       AppController（唯一对外入口）
```

### 模块内部结构：MVVM + Service + Delegate

每个模块（Domain 或 Mode）：
- **Model**：包含 BusinessService（业务逻辑）和 LifecycleService（模块生命周期：init/pause/destroy，与游戏进度无关）
- **ViewModel**：通过 EventEmitter 发出状态变化事件，不持有 DOM 引用
- **View**：订阅 ViewModel 事件，是该模块专属 DOM 区域的唯一写入者
- **Controller**：模块对外唯一入口，上层可视范围最深到此

### 关键约束

1. **Domain 模块间零直接调用**：跨域协调由 Mode Layer 的 Service 回调链驱动
2. **Canvas 唯一写入者**：RenderModule 是唯一操作 Canvas 的模块，BoardModule 通过 `drawBoard(boardState)` 传纯数据
3. **DOM 区域专属**：每个模块的 View 独占自己对应的 DOM 区域，其他模块通过 Controller 接口间接更新
4. **模式独立回调链**：每个 Mode 定义自己完整的回调链，P2PMode 在链中插入网络同步节点，其他模式的链不受影响
5. **共享单例 + teardown reset**：Domain 模块是单例，模式切换时由 AppController 调用 `oldMode.teardown()` → `newMode.setup(config)`，通过 BusinessService.reset() 清理游戏状态，不销毁模块实例
6. **顶层 View 最小化**：App Layer 的 View 仅管理开始界面，各模式的结束/退出弹窗归各 Mode 的 View 层

### Delegate 两种用法

- **注入式 Delegate**：工具类通过依赖注入传入 Domain 模块，可替换实现（如 RenderModule 的 samplerDelegate 背后是 geogebra-lite）
- **委托协议 Delegate**：模块 A 将某事委托给模块 B，B 完成后回调通知 A

## Alternatives Considered

- **按模式切分底层模块**：五种模式共享 ~80% 逻辑，按模式切会产生大量重复。否决。
- **模式层直接持有 Canvas 引用**：绘制顺序无法保证（格子必须在曲线下面），清屏时需整体重绘。否决。
- **Domain 模块间直接调用**：允许横向耦合会破坏模块独立性，某个模式不需要某步时无法单独跳过。否决。
- **SummaTrainer 独立 DevTools 层**：训练框架和正常游戏生命周期完全不同，但考虑到 AIModule 已有 Controller 接口，作为 AIModule 的 DevService 更简单，避免增加架构层次。

## Consequences

- UIController 拆解为各 Domain 模块的 View 层 + 各 Mode 的 View 层，消除单点膨胀
- GridSystem 瘦身为纯坐标工具，targetCells/forbiddenCells/usedCells/functionHistory 分别移入 BoardModule 和 RenderModule
- 新增模式时只需新建 Mode 模块并定义回调链，不触碰 Domain 层
- 每个 Domain 模块可独立测试，不依赖其他 Domain 模块
