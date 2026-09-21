// Express 4 async 路由错误捕获（社区标准包，patch 底层 Router Layer）
// 必须在其他模块 import 之前执行（本文件放 index.ts 第一个 import）
// 效果：async handler 抛错自动 next(err) → errorHandler 返回500，进程不崩
import "express-async-errors";
