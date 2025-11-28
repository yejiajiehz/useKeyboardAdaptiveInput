/**
 * 异步操作管理器
 * 用于管理定时器，确保操作的正确执行和清理
 */
export class AsyncQueueManager {
  private timerIds: number[] = [];

  /**
   * 设置安全的定时器
   */
  setTimeout(callback: () => void, delay: number): void {
    const id = setTimeout(() => {
      // 从数组中移除已执行的定时器ID
      const index = this.timerIds.indexOf(id);
      if (index > -1) {
        this.timerIds.splice(index, 1);
      }
      callback();
    }, delay) as unknown as number;
    this.timerIds.push(id);
  }

  /**
   * 清除所有定时器
   */
  clearAll(): void {
    this.timerIds.forEach((timerId) => {
      clearTimeout(timerId);
    });
    this.timerIds = [];
  }

  /**
   * 清理所有资源
   */
  dispose(): void {
    this.clearAll();
  }
}
