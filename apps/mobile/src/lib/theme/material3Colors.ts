import { Color } from 'expo-router'
import type { ColorSchemeName } from 'react-native'
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper'
import type { MD3Colors } from 'react-native-paper/lib/typescript/types'

// 使用固定浅色前景，避免系统深色动态颜色在纯白背景上失去对比度。
export function buildPureWhitePaperColors(): MD3Colors {
	return {
		...MD3LightTheme.colors,
		background: '#FFFFFF',
		surface: '#FFFFFF',
		surfaceVariant: '#FFFFFF',
		elevation: {
			level0: 'transparent',
			level1: '#FFFFFF',
			level2: '#FFFFFF',
			level3: '#FFFFFF',
			level4: '#FFFFFF',
			level5: '#FFFFFF',
		},
	}
}

/**
 * 背景と文字を、はっきりした白・黒にする。
 * 壁紙やテーマの色がうっすら混ざった灰色の面をなくし、主色や強調色はそのまま残す。
 */
export function applyCrispSurfaces(
	colors: MD3Colors,
	scheme: 'light' | 'dark',
): MD3Colors {
	if (scheme === 'dark') {
		return {
			...colors,
			background: '#000000',
			surface: '#000000',
			surfaceVariant: '#1A1A1A',
			onBackground: '#FFFFFF',
			onSurface: '#FFFFFF',
			onSurfaceVariant: '#C8C8C8',
			outline: '#8A8A8A',
			outlineVariant: '#2E2E2E',
			inverseSurface: '#FFFFFF',
			inverseOnSurface: '#000000',
			elevation: {
				level0: 'transparent',
				level1: '#0B0B0B',
				level2: '#141414',
				level3: '#1A1A1A',
				level4: '#1E1E1E',
				level5: '#232323',
			},
		}
	}
	return {
		...colors,
		background: '#FFFFFF',
		surface: '#FFFFFF',
		surfaceVariant: '#F1F1F1',
		onBackground: '#000000',
		onSurface: '#000000',
		onSurfaceVariant: '#3D3D3D',
		outline: '#6F6F6F',
		outlineVariant: '#DCDCDC',
		inverseSurface: '#1A1A1A',
		inverseOnSurface: '#FFFFFF',
		elevation: {
			level0: 'transparent',
			level1: '#FFFFFF',
			level2: '#FAFAFA',
			level3: '#F6F6F6',
			level4: '#F3F3F3',
			level5: '#F0F0F0',
		},
	}
}

/**
 * Build a React Native Paper MD3Colors object from Expo Router's dynamic Material 3 colors.
 */
export function buildMaterial3PaperColors(
	colorScheme: ColorSchemeName,
): MD3Colors {
	const d = Color.android.dynamic
	const fallback =
		colorScheme === 'dark' ? MD3DarkTheme.colors : MD3LightTheme.colors

	return {
		primary: (d.primary as string) ?? fallback.primary,
		primaryContainer:
			(d.primaryContainer as string) ?? fallback.primaryContainer,
		secondary: (d.secondary as string) ?? fallback.secondary,
		secondaryContainer:
			(d.secondaryContainer as string) ?? fallback.secondaryContainer,
		tertiary: (d.tertiary as string) ?? fallback.tertiary,
		tertiaryContainer:
			(d.tertiaryContainer as string) ?? fallback.tertiaryContainer,
		surface: (d.surface as string) ?? fallback.surface,
		surfaceVariant: (d.surfaceVariant as string) ?? fallback.surfaceVariant,
		background: (d.background as string) ?? fallback.background,
		error: (d.error as string) ?? fallback.error,
		errorContainer: (d.errorContainer as string) ?? fallback.errorContainer,
		onPrimary: (d.onPrimary as string) ?? fallback.onPrimary,
		onPrimaryContainer:
			(d.onPrimaryContainer as string) ?? fallback.onPrimaryContainer,
		onSecondary: (d.onSecondary as string) ?? fallback.onSecondary,
		onSecondaryContainer:
			(d.onSecondaryContainer as string) ?? fallback.onSecondaryContainer,
		onTertiary: (d.onTertiary as string) ?? fallback.onTertiary,
		onTertiaryContainer:
			(d.onTertiaryContainer as string) ?? fallback.onTertiaryContainer,
		onSurface: (d.onSurface as string) ?? fallback.onSurface,
		onSurfaceVariant:
			(d.onSurfaceVariant as string) ?? fallback.onSurfaceVariant,
		onError: (d.onError as string) ?? fallback.onError,
		onErrorContainer:
			(d.onErrorContainer as string) ?? fallback.onErrorContainer,
		onBackground: (d.onBackground as string) ?? fallback.onBackground,
		outline: (d.outline as string) ?? fallback.outline,
		outlineVariant: (d.outlineVariant as string) ?? fallback.outlineVariant,
		// Renamed in Expo Router: surfaceInverse → inverseSurface
		inverseSurface: (d.surfaceInverse as string) ?? fallback.inverseSurface,
		inverseOnSurface:
			(d.onSurfaceInverse as string) ?? fallback.inverseOnSurface,
		inversePrimary: (d.primaryInverse as string) ?? fallback.inversePrimary,
		shadow: fallback.shadow,
		scrim: fallback.scrim,
		// Not available from Expo Router dynamic colors — use Paper defaults
		surfaceDisabled: fallback.surfaceDisabled,
		onSurfaceDisabled: fallback.onSurfaceDisabled,
		backdrop: fallback.backdrop,
		elevation: fallback.elevation,
	}
}
