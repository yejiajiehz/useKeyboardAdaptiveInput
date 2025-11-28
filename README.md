# useKeyboardAdaptiveInput H5 键盘高度处理

## 问题背景

在 H5 上进行键盘输入时，某些场景下键盘会直接覆盖在页面之上，遮挡输入区域

## 核心规则

在输入框聚焦之后，通过 resize 事件判断页面高度是否发生变化
- 如果页面高度变化了，可以认为浏览器已处理好键盘遮挡问题，无须处理该场景
- 如果页面高度无变化，假设键盘高度为 300px；判断输入框是否被遮挡在页面底部 300px 的位置
  - 如果未遮挡，无须处理
  - 如果被遮挡了，尝试滚动到输入框到可见位置
    - 如果滚动失败，在滚动容器底部添加 300px 的 padding，再尝试滚动

添加防抖等逻辑，避免快速聚焦失焦导致的重复滚动
- 如果当前键盘在展开中、已展开状态，忽略新的聚焦事件
- 如果当前键盘在收起中，立刻结束当前的键盘收起事件

 ## 使用方式
 ```typescript
 import { useKeyboardAdaptiveInput } from 'use-keyboard';
 
 function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  useKeyboardAdaptiveInput(inputRef, options);
  
  return <input ref={inputRef} />
 }
 ```

 ### 选项

| 配置项 | 说明 | 默认值 |
| ----- | --- | ----- |
| estimatedKeyboardHeight | 预估的键盘高度（px） | 300 |
| safeInputPadding | 输入框与键盘之间的安全间距（px） | 16 |
| keyboardExpandWaitTime | 键盘展开时的等待时间（ms） | 150 |
| scrollRecheckInterval | 输入框滚动后重新检查可见性的时间间隔（ms） | 100 |
| keyboardCollapseCleanupTime | 失焦之后，清理底部占位元素的延迟时间（ms） | 100 |
| keyboardPaddingContainer | 用于添加键盘间距的容器元素 | document.body |
