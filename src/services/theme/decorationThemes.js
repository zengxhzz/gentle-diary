import cloudImage from '@/assets/themes/light-paper/cloud.png'
import plantImage from '@/assets/themes/light-paper/plant.png'
import catImage from '@/assets/themes/light-paper/cat.png'
import planeImage from '@/assets/themes/light-paper/paper-plane.png'
import moonImage from '@/assets/themes/light-paper/moon.png'
import geometryImage from '@/assets/themes/light-paper/geometry.png'

/**
 * 「轻描纸印」只包含随 App 打包的透明 UI 素材，不是用户附件。
 * 保留已有主题 ID，历史设置、每日轮换和备份中的主题引用无需迁移。
 */
export const LIGHT_PAPER_PALETTE = Object.freeze({
  accent: '#9EA99C',
  soft: '#E5E9DE',
  warm: '#D9C8AC',
})

function defineTheme(id, name, decorationId, image) {
  return {
    id,
    name,
    styleVariant: 'light-paper',
    palette: LIGHT_PAPER_PALETTE,
    decorations: [{ id: decorationId, image, size: 64 }],
  }
}

export const decorationThemes = [
  defineTheme('cloud', '云朵', 'cloud-main', cloudImage),
  defineTheme('plant', '植物', 'plant-main', plantImage),
  defineTheme('cat', '小猫', 'cat-main', catImage),
  defineTheme('paper-plane', '纸飞机', 'plane-main', planeImage),
  defineTheme('moon', '星月', 'moon-main', moonImage),
  defineTheme('geometry', '几何', 'geometry-main', geometryImage),
]

/** @param {string} id */
export function getDecorationThemeById(id) {
  return decorationThemes.find((theme) => theme.id === id) ?? decorationThemes[0]
}
