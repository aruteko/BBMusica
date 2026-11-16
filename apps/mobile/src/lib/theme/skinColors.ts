import Color from 'color'
import type { MD3Colors } from 'react-native-paper/lib/typescript/types'

/**
 * テーマ（装扮）のメインカラーから、アプリ全体の配色（Material 3 の役割ごとの色）を作る。
 *
 * 色相は、メインカラーを保ち、明るさと彩度を、ライト / ダークそれぞれの
 * Material 3 の基準に合わせて決める（文字と背景のコントラストを確保するため）。
 */

type Scheme = 'light' | 'dark'

/** 色相 h（0〜360）、彩度 s、明度 l（0〜100）から、16進の色を作る */
const hsl = (h: number, s: number, l: number): string =>
	Color.hsl(((h % 360) + 360) % 360, s, l).hex()

const withAlpha = (hex: string, alpha: number): string =>
	Color(hex).alpha(alpha).rgb().string()

/** 彩度が低すぎる（白・黒・灰色）色は、アクセントとして使えない */
const MIN_SATURATION = 15

/**
 * テーマの色の候補から、アプリの主色にできるものを選ぶ。
 * 選択中のタブの色などを優先し、無彩色（文字色の白・黒など）は避ける。
 */
export function pickSkinSeedColor(
	candidates: Array<string | null | undefined>,
): string | null {
	for (const candidate of candidates) {
		if (!candidate) continue
		try {
			const color = Color(candidate)
			if (color.hsl().saturationl() >= MIN_SATURATION) return color.hex()
		} catch {
			// 解釈できない色は飛ばす
		}
	}
	return null
}

export function buildSkinPaperColors(seed: string, scheme: Scheme): MD3Colors {
	const dark = scheme === 'dark'
	const base = Color(seed).hsl()
	const hue = base.hue()
	// 主色の彩度は、鮮やかすぎず、くすみすぎない範囲に収める
	const sat = Math.min(85, Math.max(40, base.saturationl()))

	const primary = hsl(hue, sat, dark ? 78 : 42)
	const onPrimary = hsl(hue, Math.min(sat, 60), dark ? 18 : 100)
	const primaryContainer = hsl(hue, Math.min(sat, 70), dark ? 28 : 90)
	const onPrimaryContainer = hsl(hue, Math.min(sat, 80), dark ? 90 : 12)

	const secondaryHue = hue
	const secondary = hsl(secondaryHue, 22, dark ? 76 : 40)
	const onSecondary = hsl(secondaryHue, 22, dark ? 20 : 100)
	const secondaryContainer = hsl(secondaryHue, 28, dark ? 30 : 90)
	const onSecondaryContainer = hsl(secondaryHue, 30, dark ? 90 : 12)

	const tertiaryHue = hue + 60
	const tertiary = hsl(tertiaryHue, 30, dark ? 76 : 42)
	const onTertiary = hsl(tertiaryHue, 30, dark ? 20 : 100)
	const tertiaryContainer = hsl(tertiaryHue, 34, dark ? 30 : 90)
	const onTertiaryContainer = hsl(tertiaryHue, 36, dark ? 90 : 12)

	const background = hsl(hue, dark ? 10 : 25, dark ? 9 : 98)
	const surface = background
	const onSurface = hsl(hue, 8, dark ? 90 : 10)
	const surfaceVariant = hsl(hue, dark ? 10 : 22, dark ? 26 : 90)
	const onSurfaceVariant = hsl(hue, 10, dark ? 78 : 30)
	const outline = hsl(hue, 8, dark ? 60 : 46)
	const outlineVariant = hsl(hue, 10, dark ? 30 : 80)

	// 標準の Material 3 のエラー色（テーマに左右されない）
	const error = dark ? '#FFB4AB' : '#BA1A1A'
	const onError = dark ? '#690005' : '#FFFFFF'
	const errorContainer = dark ? '#93000A' : '#FFDAD6'
	const onErrorContainer = dark ? '#FFDAD6' : '#410002'

	// 面の高さ（elevation）は、面の色に主色を少し混ぜて表す（Material 3 の決まり）
	const tint = (ratio: number) =>
		Color(surface).mix(Color(primary), ratio).hex()

	return {
		primary,
		onPrimary,
		primaryContainer,
		onPrimaryContainer,
		secondary,
		onSecondary,
		secondaryContainer,
		onSecondaryContainer,
		tertiary,
		onTertiary,
		tertiaryContainer,
		onTertiaryContainer,
		error,
		onError,
		errorContainer,
		onErrorContainer,
		background,
		onBackground: onSurface,
		surface,
		onSurface,
		surfaceVariant,
		onSurfaceVariant,
		outline,
		outlineVariant,
		shadow: '#000000',
		scrim: '#000000',
		inverseSurface: hsl(hue, 8, dark ? 90 : 20),
		inverseOnSurface: hsl(hue, 8, dark ? 20 : 95),
		inversePrimary: hsl(hue, sat, dark ? 42 : 78),
		surfaceDisabled: withAlpha(onSurface, 0.12),
		onSurfaceDisabled: withAlpha(onSurface, 0.38),
		backdrop: 'rgba(0, 0, 0, 0.4)',
		elevation: {
			level0: 'transparent',
			level1: tint(0.05),
			level2: tint(0.08),
			level3: tint(0.11),
			level4: tint(0.12),
			level5: tint(0.14),
		},
	}
}
