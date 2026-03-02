export interface EnvironmentPreset {
  id: string;
  label: string;
  thumbnail: string;
  description: string;
  /** CSS gradient used as fallback when thumbnail image is not available */
  fallbackGradient: string;
}

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: "default",
    label: "デフォルト",
    thumbnail: "/environments/default.jpg",
    description: "標準的な環境",
    fallbackGradient: "linear-gradient(135deg, #87CEEB 0%, #228B22 100%)",
  },
  {
    id: "forest",
    label: "森林",
    thumbnail: "/environments/forest.jpg",
    description: "緑豊かな森",
    fallbackGradient: "linear-gradient(135deg, #2d5016 0%, #1a3a0a 100%)",
  },
  {
    id: "japan",
    label: "日本庭園",
    thumbnail: "/environments/japan.jpg",
    description: "和風の庭園",
    fallbackGradient: "linear-gradient(135deg, #FFB7C5 0%, #2E8B57 100%)",
  },
  {
    id: "dream",
    label: "夢の世界",
    thumbnail: "/environments/dream.jpg",
    description: "幻想的な空間",
    fallbackGradient: "linear-gradient(135deg, #E0B0FF 0%, #8B00FF 100%)",
  },
  {
    id: "starry",
    label: "星空",
    thumbnail: "/environments/starry.jpg",
    description: "満天の星空",
    fallbackGradient: "linear-gradient(135deg, #0c1445 0%, #1a0533 100%)",
  },
  {
    id: "tron",
    label: "サイバー",
    thumbnail: "/environments/tron.jpg",
    description: "サイバー空間",
    fallbackGradient: "linear-gradient(135deg, #000000 0%, #00FFFF 100%)",
  },
  {
    id: "egypt",
    label: "エジプト",
    thumbnail: "/environments/egypt.jpg",
    description: "砂漠のピラミッド",
    fallbackGradient: "linear-gradient(135deg, #F4A460 0%, #DEB887 100%)",
  },
  {
    id: "volcano",
    label: "火山",
    thumbnail: "/environments/volcano.jpg",
    description: "火山地帯",
    fallbackGradient: "linear-gradient(135deg, #8B0000 0%, #FF4500 100%)",
  },
  {
    id: "arches",
    label: "アーチ",
    thumbnail: "/environments/arches.jpg",
    description: "石のアーチ",
    fallbackGradient: "linear-gradient(135deg, #CD853F 0%, #8B4513 100%)",
  },
  {
    id: "osiris",
    label: "オシリス",
    thumbnail: "/environments/osiris.jpg",
    description: "神秘的な世界",
    fallbackGradient: "linear-gradient(135deg, #2F4F4F 0%, #008080 100%)",
  },
  {
    id: "threetowers",
    label: "三塔",
    thumbnail: "/environments/threetowers.jpg",
    description: "そびえ立つ3つの塔",
    fallbackGradient: "linear-gradient(135deg, #4682B4 0%, #2F4F4F 100%)",
  },
  {
    id: "poison",
    label: "毒沼",
    thumbnail: "/environments/poison.jpg",
    description: "危険な毒の沼地",
    fallbackGradient: "linear-gradient(135deg, #556B2F 0%, #9ACD32 100%)",
  },
  {
    id: "goldmine",
    label: "金鉱",
    thumbnail: "/environments/goldmine.jpg",
    description: "金の鉱山",
    fallbackGradient: "linear-gradient(135deg, #DAA520 0%, #B8860B 100%)",
  },
  {
    id: "goaland",
    label: "草原",
    thumbnail: "/environments/goaland.jpg",
    description: "広大な草原",
    fallbackGradient: "linear-gradient(135deg, #87CEEB 0%, #90EE90 100%)",
  },
  {
    id: "yavapai",
    label: "ヤバパイ",
    thumbnail: "/environments/yavapai.jpg",
    description: "渓谷の風景",
    fallbackGradient: "linear-gradient(135deg, #E2725B 0%, #CC5500 100%)",
  },
  {
    id: "checkerboard",
    label: "チェッカー",
    thumbnail: "/environments/checkerboard.jpg",
    description: "チェッカーボード",
    fallbackGradient: "linear-gradient(135deg, #333333 0%, #CCCCCC 100%)",
  },
  {
    id: "contact",
    label: "コンタクト",
    thumbnail: "/environments/contact.jpg",
    description: "異星のコンタクト",
    fallbackGradient: "linear-gradient(135deg, #191970 0%, #4B0082 100%)",
  },
];

/** Validate if a preset id is valid */
export function isValidPreset(preset: string): boolean {
  return ENVIRONMENT_PRESETS.some((p) => p.id === preset);
}

/** Get preset metadata by id */
export function getPresetById(id: string): EnvironmentPreset | undefined {
  return ENVIRONMENT_PRESETS.find((p) => p.id === id);
}
