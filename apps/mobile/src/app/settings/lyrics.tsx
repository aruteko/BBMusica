import { Orpheus } from '@bbplayer/orpheus'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useAppStore } from '@/hooks/stores/useAppStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import lyricService from '@/lib/services/lyricService'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { t } from '@/i18n'

function applyStatusBarLyricsProvider(
	provider: 'superlyric' | 'lyricon' | 'meizu',
	syncStates: () => void,
) {
	try {
		Orpheus.statusBarLyricsProvider = provider
		syncStates()
	} catch (e) {
		toastAndLogError(t('設定に失敗しました'), e, 'Settings')
	}
}

export default function LyricsSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const lyriconConnectionToast = useRef<string | number | null>(null)
	const finishLyriconConnectionToast = useCallback((connected = false) => {
		const id = lyriconConnectionToast.current
		if (id === null) return
		lyriconConnectionToast.current = null
		if (connected) {
			toast.success(t('詞幕に接続しました'), { id, duration: 2000 })
		} else {
			toast.dismiss(id)
		}
	}, [])

	const [isDesktopLyricsShown, setIsDesktopLyricsShown] = useState(
		Orpheus.isDesktopLyricsShown,
	)
	const [isDesktopLyricsLocked, setIsDesktopLyricsLocked] = useState(
		Orpheus.isDesktopLyricsLocked,
	)
	const [isStatusBarLyricsEnabled, setIsStatusBarLyricsEnabled] = useState(
		Orpheus.isStatusBarLyricsEnabled,
	)
	const [isCarLyricsEnabled, setIsCarLyricsEnabled] = useState(
		Orpheus.isCarLyricsEnabled,
	)
	const [isSuperLyricApiEnabled, setIsSuperLyricApiEnabled] = useState(
		Orpheus.isSuperLyricApiEnabled,
	)
	const [isLyriconApiEnabled, setIsLyriconApiEnabled] = useState(
		Orpheus.isLyriconApiEnabled,
	)
	const [statusBarLyricsProvider, setStatusBarLyricsProvider] = useState(
		Orpheus.statusBarLyricsProvider ?? 'lyricon',
	)

	const lyricSource = useAppStore((state) => state.settings.lyricSource)
	const enableVerbatimLyrics = useAppStore(
		(state) => state.settings.enableVerbatimLyrics,
	)
	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const isStatusBarLyricsProviderActive =
		statusBarLyricsProvider === 'lyricon'
			? isLyriconApiEnabled
			: statusBarLyricsProvider === 'meizu'
				? true
				: isSuperLyricApiEnabled
	const isLyriconConnecting =
		statusBarLyricsProvider === 'lyricon' &&
		isStatusBarLyricsEnabled &&
		!isLyriconApiEnabled

	const inactiveStatusBarLyricsProviderText =
		statusBarLyricsProvider === 'lyricon'
			? isLyriconConnecting
				? t(' 詞幕に接続中')
				: t(' 詞幕に未接続')
			: statusBarLyricsProvider === 'meizu'
				? t(' Flymeのみ')
				: t(' SuperLyricが必要')

	// Lyricon tries to connect when enabled; a failed attempt turns the setting off.
	const isStatusBarLyricsSwitchDisabled =
		statusBarLyricsProvider !== 'lyricon' && !isStatusBarLyricsProviderActive

	const syncStates = useCallback(async () => {
		if (
			Orpheus.statusBarLyricsProvider !== 'lyricon' ||
			!Orpheus.isStatusBarLyricsEnabled ||
			Orpheus.isLyriconApiEnabled
		) {
			finishLyriconConnectionToast(
				Orpheus.statusBarLyricsProvider === 'lyricon' &&
					Orpheus.isStatusBarLyricsEnabled &&
					Orpheus.isLyriconApiEnabled,
			)
		}
		const hasPermission = await Orpheus.checkOverlayPermission()
		// UI 开关仅在「设置开启」且「有权限」时显示为 ON
		setIsDesktopLyricsShown(Orpheus.isDesktopLyricsShown && hasPermission)
		setIsDesktopLyricsLocked(Orpheus.isDesktopLyricsLocked)
		setIsStatusBarLyricsEnabled(Orpheus.isStatusBarLyricsEnabled)
		setIsCarLyricsEnabled(Orpheus.isCarLyricsEnabled)
		setIsSuperLyricApiEnabled(Orpheus.isSuperLyricApiEnabled)
		setIsLyriconApiEnabled(Orpheus.isLyriconApiEnabled)
		setStatusBarLyricsProvider(Orpheus.statusBarLyricsProvider ?? 'lyricon')
	}, [finishLyriconConnectionToast])

	const providerMenu = useMenuActions([
		{
			title: `SuperLyric${!isSuperLyricApiEnabled ? t(' 未有効') : ''}`,
			state: statusBarLyricsProvider === 'superlyric' ? 'on' : 'off',
			onPress: () => applyStatusBarLyricsProvider('superlyric', syncStates),
		},
		{
			title: `${t('詞幕 Lyricon')}${statusBarLyricsProvider === 'lyricon' && !isLyriconApiEnabled ? t(' 未接続') : ''}`,
			state: statusBarLyricsProvider === 'lyricon' ? 'on' : 'off',
			onPress: () => applyStatusBarLyricsProvider('lyricon', syncStates),
		},
		{
			title: t('Meizuのステータスバー歌詞'),
			state: statusBarLyricsProvider === 'meizu' ? 'on' : 'off',
			onPress: () => applyStatusBarLyricsProvider('meizu', syncStates),
		},
	])

	const lyricSourceMenu = useMenuActions([
		{
			title: 'NetEase Cloud Music',
			state: lyricSource === 'netease' ? 'on' : 'off',
			onPress: () => setSettings({ lyricSource: 'netease' }),
		},
		{
			title: t('QQ音楽'),
			state: lyricSource === 'qqmusic' ? 'on' : 'off',
			onPress: () => setSettings({ lyricSource: 'qqmusic' }),
		},
		{
			title: 'KuGou Music',
			state: lyricSource === 'kugou' ? 'on' : 'off',
			onPress: () => setSettings({ lyricSource: 'kugou' }),
		},
		{
			title: t('自動'),
			state: lyricSource === 'auto' ? 'on' : 'off',
			onPress: () => {
				setSettings({ lyricSource: 'auto' })
				toast.info(
					t('最初に返ったソースを使います'),
				)
			},
		},
	])

	const enableDesktopLyrics = async () => {
		try {
			const hasPermission = await Orpheus.checkOverlayPermission()
			if (hasPermission) {
				await Orpheus.showDesktopLyrics()
				void syncStates()
				// 立即推送当前正在播放的歌词，不等下一首
				const currentTrack = await Orpheus.getCurrentTrack()
				if (currentTrack) {
					void lyricService.pushLyricsToOverlays(currentTrack.id)
				}
				return
			}
			alert(
				t('デスクトップ歌詞'),
				t('他のアプリの上に重ねて表示する権限が必要です'),
				[
					{ text: t('キャンセル') },
					{
						text: t('設定を開く'),
						onPress: async () => {
							await Orpheus.requestOverlayPermission()
						},
					},
				],
				{ cancelable: true },
			)
		} catch (e) {
			toastAndLogError(t('デスクトップ歌詞の設定に失敗しました'), e, 'Settings')
		}
	}

	useEffect(() => {
		const listener = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				void syncStates()
			}
		})

		const statusListener = Orpheus.addListener(
			'onStatusBarLyricsStatusChanged',
			() => {
				void syncStates()
			},
		)

		return () => {
			listener.remove()
			statusListener.remove()
		}
	}, [syncStates])

	useFocusEffect(
		useCallback(() => {
			void syncStates()
			return () => finishLyriconConnectionToast()
		}, [syncStates, finishLyriconConnectionToast]),
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t('歌詞の設定')} />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title={t('歌詞の表示')}
					first
				/>
				<View style={styles.settingRow}>
					<Text>{t('1文字ずつの歌詞を表示')}</Text>
					<UniversalSwitch
						value={enableVerbatimLyrics}
						onValueChange={() =>
							setSettings({ enableVerbatimLyrics: !enableVerbatimLyrics })
						}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>{t('旧バージョンの歌詞スタイルに戻す')}</Text>
					<UniversalSwitch
						value={enableOldSchoolStyleLyric}
						onValueChange={() =>
							setSettings({
								enableOldSchoolStyleLyric: !enableOldSchoolStyleLyric,
							})
						}
					/>
				</View>
				{Platform.OS === 'android' && (
					<>
						<SettingsSectionTitle title={t('システム歌詞')} />
						<View style={styles.settingRow}>
							<Text>{t('デスクトップ歌詞')}</Text>
							<UniversalSwitch
								value={isDesktopLyricsShown}
								onValueChange={async () => {
									try {
										// 如果当前视觉上是开着的，点击必定是想关掉
										if (isDesktopLyricsShown) {
											await Orpheus.hideDesktopLyrics()
											void syncStates()
										} else {
											// 如果当前视觉上是关着的（可能是没权限，也可能是设置就是关的）
											// 我们统一走 enable 流程（含权限检查）
											await enableDesktopLyrics()
										}
									} catch (e) {
										toastAndLogError(t('設定に失敗しました'), e, 'Settings')
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<Text>{t('デスクトップ歌詞をロック')}</Text>
							<UniversalSwitch
								value={isDesktopLyricsLocked}
								onValueChange={async () => {
									try {
										Orpheus.isDesktopLyricsLocked = !isDesktopLyricsLocked
										await syncStates()
									} catch (e) {
										toastAndLogError(t('設定に失敗しました'), e, 'Settings')
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<View style={{ flex: 1, marginRight: 16 }}>
								<Text>{t('車載用の歌詞')}</Text>
								<Text
									style={{
										fontSize: 12,
										opacity: 0.55,
										marginTop: 4,
									}}
								>{t('有効にすると、現在の歌詞をメディア情報のタイトル部分に表示します')}</Text>
							</View>
							<UniversalSwitch
								value={isCarLyricsEnabled}
								onValueChange={async () => {
									try {
										const next = !isCarLyricsEnabled
										Orpheus.isCarLyricsEnabled = next
										await syncStates()
										if (next) {
											const currentTrack = await Orpheus.getCurrentTrack()
											if (currentTrack) {
												void lyricService.pushLyricsToOverlays(currentTrack.id)
											}
										}
									} catch (e) {
										toastAndLogError(t('設定に失敗しました'), e, 'Settings')
									}
								}}
							/>
						</View>
						<View style={styles.settingRow}>
							<Text>{t('ステータスバー歌詞のフレームワーク')}</Text>
							<MenuView {...providerMenu}>
								<IconButton
									icon='playlist-music'
									size={20}
								/>
							</MenuView>
						</View>
						<View style={styles.settingRow}>
							<View style={{ flex: 1, marginRight: 16 }}>
								<Text
									style={
										isStatusBarLyricsSwitchDisabled
											? { opacity: 0.4 }
											: undefined
									}
								>{t('ステータスバー歌詞')}{!isStatusBarLyricsProviderActive
										? inactiveStatusBarLyricsProviderText
										: ''}
								</Text>
								{!isStatusBarLyricsProviderActive && !isLyriconConnecting && (
									<Text
										style={{
											fontSize: 12,
											opacity: 0.5,
											marginTop: 4,
										}}
									>
										{statusBarLyricsProvider === 'lyricon'
											? t('オンにすると接続を試します')
											: t('利用できる環境がありません')}
									</Text>
								)}
							</View>
							<UniversalSwitch
								disabled={isStatusBarLyricsSwitchDisabled}
								value={isStatusBarLyricsEnabled}
								onValueChange={async () => {
									try {
										const next = !isStatusBarLyricsEnabled
										if (statusBarLyricsProvider === 'lyricon' && next) {
											lyriconConnectionToast.current = toast.loading(
												t('詞幕に接続中…'),
												{
													id: lyriconConnectionToast.current ?? undefined,
													duration: Infinity,
												},
											)
										} else {
											finishLyriconConnectionToast()
										}
										setIsStatusBarLyricsEnabled(next)
										Orpheus.isStatusBarLyricsEnabled = next
										await syncStates()
										if (next) {
											// 立即推送当前歌词
											const currentTrack = await Orpheus.getCurrentTrack()
											if (currentTrack) {
												void lyricService.pushLyricsToOverlays(currentTrack.id)
											}
										}
									} catch (e) {
										finishLyriconConnectionToast()
										setIsStatusBarLyricsEnabled(
											Orpheus.isStatusBarLyricsEnabled,
										)
										toastAndLogError(t('設定に失敗しました'), e, 'Settings')
									}
								}}
							/>
						</View>
					</>
				)}
				<SettingsSectionTitle title={t('歌詞のソース')} />
				<View style={styles.settingRow}>
					<Text>{t('自動で照合する歌詞ソース')}</Text>
					<MenuView {...lyricSourceMenu}>
						<IconButton
							icon='playlist-music'
							size={20}
						/>
					</MenuView>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 25,
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
})
