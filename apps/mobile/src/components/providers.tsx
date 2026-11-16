import { setFocusRingColor } from '@bbplayer/native'
import { Orpheus } from '@bbplayer/orpheus'
import { useRequireProfilerDevTools } from '@rozenite/require-profiler-plugin'
import {
	createMMKVStorageAdapter,
	useRozeniteStoragePlugin,
} from '@rozenite/storage-plugin'
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import {
	Appearance,
	Platform,
	StyleSheet,
	useColorScheme,
	View,
} from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RNShake from 'react-native-shake'

import GlobalErrorFallback from '@/components/ErrorBoundary'
import { alert } from '@/components/modals/AlertModal'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { queryClient } from '@/lib/config/queryClient'
import { buildSkinPaperColors, pickSkinSeedColor } from '@/lib/theme/skinColors'
import {
	captureProfiling,
	isShakeProfilingEnabled,
	PROFILING_DURATION_MS,
} from '@/lib/performance'
import {
	applyCrispSurfaces,
	buildMaterial3PaperColors,
	buildPureWhitePaperColors,
} from '@/lib/theme/material3Colors'
import { storage } from '@/utils/mmkv'
import { t } from '@/i18n'

function DevTools() {
	useTanStackQueryDevTools(queryClient)
	useRozeniteStoragePlugin({
		storages: [
			createMMKVStorageAdapter({
				storages: {
					app: storage,
				},
			}),
		],
	})
	useRequireProfilerDevTools()
	return null
}

function ShakeProfiler() {
	const promptVisibleRef = useRef(false)

	useEffect(() => {
		const subscription = RNShake.addListener(() => {
			if (!isShakeProfilingEnabled() || promptVisibleRef.current) return
			promptVisibleRef.current = true

			alert(
				t('パフォーマンス分析を記録'),
				t('10秒間のパフォーマンスを記録しますか？'),
				[
					{
						text: t('キャンセル'),
						onPress: () => {
							promptVisibleRef.current = false
							useModalStore.getState().close('Alert')
						},
					},
					{
						text: t('記録を開始'),
						onPress: () => {
							promptVisibleRef.current = false
							void captureProfiling(PROFILING_DURATION_MS)
						},
					},
				],
			)
		})

		return () => subscription.remove()
	}, [])

	return null
}

export default function AppProviders({ children }: { children: ReactNode }) {
	const colorScheme = useColorScheme()
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)
	useEffect(() => {
		if (Platform.OS === 'android') {
			Orpheus.isNotificationArtworkEnabled = !pureWhiteBackground
		}
	}, [pureWhiteBackground])
	useEffect(() => {
		// 同步原生控件、系统菜单，以及仍读取 useColorScheme 的组件。
		Appearance.setColorScheme(pureWhiteBackground ? 'light' : 'unspecified')
		return () => Appearance.setColorScheme('unspecified')
	}, [pureWhiteBackground])

	// テーマ（装扮）のメインカラーを、アプリ全体の配色に使う
	const followSkinColor = useAppStore(
		(state) => state.settings.skinAccentColor ?? true,
	)
	const activeSkin = useActiveSkin()
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const skinSeedColor = useSkinStore((state) => state.activeSeedColor)
	useEffect(() => {
		// テーマを外したら、色も元に戻す。読み込めたら、メインカラーを保存する
		if (!activeSkinId) {
			useSkinStore.getState().setActiveSeedColor(null)
			return
		}
		if (!activeSkin) return
		const colors = activeSkin.skins[activeSkinIndex]?.colors
		useSkinStore.getState().setActiveSeedColor(
			pickSkinSeedColor([
				colors?.tailColorSelected,
				colors?.colorSecondPage,
				colors?.tailColor,
				colors?.color,
			]),
		)
	}, [activeSkin, activeSkinId, activeSkinIndex])

	const paperTheme = useMemo(() => {
		if (pureWhiteBackground) {
			return { ...MD3LightTheme, colors: buildPureWhitePaperColors() }
		}
		const scheme = colorScheme === 'dark' ? 'dark' : 'light'
		const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme
		if (followSkinColor && activeSkinId && skinSeedColor) {
			return {
				...base,
				colors: applyCrispSurfaces(
					buildSkinPaperColors(skinSeedColor, scheme),
					scheme,
				),
			}
		}
		return {
			...base,
			colors: applyCrispSurfaces(buildMaterial3PaperColors(scheme), scheme),
		}
	}, [
		colorScheme,
		pureWhiteBackground,
		followSkinColor,
		activeSkinId,
		skinSeedColor,
	])

	useEffect(() => {
		// 遥控器 / 键盘导航时的焦点框跟随主题色。
		setFocusRingColor(paperTheme.colors.primary)
	}, [paperTheme.colors.primary])

	return (
		<SafeAreaProvider>
			<KeyboardProvider>
				<View
					style={[
						styles.container,
						{ backgroundColor: paperTheme.colors.background },
					]}
				>
					<Sentry.ErrorBoundary
						// oxlint-disable-next-line @typescript-eslint/unbound-method
						fallback={({ error, resetError }) => (
							<GlobalErrorFallback
								error={error}
								resetError={resetError}
							/>
						)}
					>
						<GestureHandlerRootView style={styles.container}>
							<QueryClientProvider client={queryClient}>
								<PaperProvider theme={paperTheme}>
									{__DEV__ ? <DevTools /> : null}
									<ShakeProfiler />
									{children}
								</PaperProvider>
							</QueryClientProvider>
						</GestureHandlerRootView>
					</Sentry.ErrorBoundary>
					<SystemBars style={pureWhiteBackground ? 'dark' : 'auto'} />
				</View>
			</KeyboardProvider>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
})
