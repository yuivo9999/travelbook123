# ZIP 导入 V2

## 目标
提升“数字手账本”在不同设备、不同浏览器和 GitHub Pages 项目路径下导入 ZIP 全量备份的兼容性，并让失败原因可定位。

## V2 改动
- 当前新导出版本升级为 `5.0.0`。
- 继续兼容 V4/V5 ZIP 全量备份。
- ZIP 继续支持 Stored（0）和 DEFLATE（8）。
- 原生 `DecompressionStream('deflate-raw')` 可用时优先使用。
- 原生解压不可用时，按 Vite `BASE_URL` 动态加载本地 pako，不再依赖域名根路径；GitHub Pages 的 `/travelbook123/` 项目路径也能正确解析。
- `manifest.json` 存在时执行格式校验；data.json、manifest 和压缩媒体执行 CRC 校验。
- 导入解析阶段检查内容索引引用的媒体，避免导入后无可见变化的隐性失败。
- ZIP 结构、解压、JSON、CRC、媒体读取分别给出明确错误。
- 大型原始媒体继续通过 Blob/OPFS 路径恢复，不要求把整个 ZIP 一次性读入内存。

## 兼容策略
旧的 V4 ZIP 备份继续可以导入；V5 是当前导出版本。未来格式升级时继续保留向后兼容入口。

## 已知边界
当前自定义 ZIP 写入器仍使用 32-bit ZIP 尺寸/偏移字段，超过约 4 GiB 的单个归档不在支持范围。
