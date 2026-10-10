/**
 * Media Provider 契约。编辑器只依赖此接口，不直接调用文件选择器或原生插件。
 * @interface
 */
export class MediaProvider {
  async pickImage(_options) { throw new Error('Not implemented') }
  onRestoredImage(_listener) { return () => {} }
}
