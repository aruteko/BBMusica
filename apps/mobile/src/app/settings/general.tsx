import * as Expo from 'expo'
import * as FileSystem from 'expo-file-system'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useRef, useState, useSyncExternalStore } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import {
	getLanguageSetting,
	setLanguageSetting,
	t,
	type LanguageSetting,
} from '@/i18n'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { toastAndLogError } from '@/utils/error-handling'
import { flushLogs } from '@/utils/log'
import {
	getStartupScreen,
	setStartupScreen as persistStartupScreen,
	subscribeStartupScreen,
} from '@/utils/startup-screen'
import toast from '@/utils/toast'

function setStartupScreen(screen: 'home' | 'library') {
	persistStartupScreen(screen)
}

export default function GeneralSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)

	const setEnableDataCollection = useAppStore(
		(state) => state.setEnableDataCollection,
	)
	const enableDataCollection = useAppStore(
		(state) => state.settings.enableDataCollection,
	)

	const setEnableDebugLog = useAppStore((state) => state.setEnableDebugLog)
	const enableDebugLog = useAppStore((state) => state.settings.enableDebugLog)
	const expandMultiPageOnSync = useAppStore(
		(state) => state.settings.expandMultiPageOnSync,
	)

	const startupScreen = useSyncExternalStore(
		subscribeStartupScreen,
		getStartupScreen,
	)

	const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false)

	const [languageSetting, setLanguageState] = useState<LanguageSetting>(
		getLanguageSetting(),
	)
	const changeLanguage = (next: LanguageSetting) => {
		if (next === languageSetting) return
		setLanguageSetting(next)
		setLanguageState(next)
		alert(
			t('言語'),
			t('再起動すると反映されます'),
			[
				{ text: t('あとで') },
				{ text: t('今すぐ再起動'), onPress: () => void Expo.reloadAppAsync() },
			],
			{ cancelable: true },
		)
	}
	const languageMenuActions = useMenuActions([
		{
			title: t('自動'),
			state: languageSetting === 'auto' ? 'on' : 'off',
			onPress: () => changeLanguage('auto'),
		},
		{
			title: t('日本語'),
			state: languageSetting === 'ja' ? 'on' : 'off',
			onPress: () => changeLanguage('ja'),
		},
		{
			title: t('中文'),
			state: languageSetting === 'zh' ? 'on' : 'off',
			onPress: () => changeLanguage('zh'),
		},
	])

	const handleCheckForUpdate = async () => {
		setIsCheckingForUpdate(true)
		try {
			const result = await checkForAppUpdate()
			if (result.isErr()) {
				toast.error(t('アップデートの確認に失敗しました'), { description: result.error.message })
				setIsCheckingForUpdate(false)
				return
			}

			const { update } = result.value
			if (update) {
				if (update.forced) {
					openModal('UpdateApp', update, { dismissible: false })
				} else {
					openModal('UpdateApp', update)
				}
			} else {
				toast.success(t('最新バージョンです'))
			}
		} catch (e) {
			toast.error(t('アップデートの確認中に不明なエラーが発生しました'), { description: String(e) })
		}
		setIsCheckingForUpdate(false)
	}

	const [isSharing, setIsSharing] = useState(false)
	const isSharingRef = useRef(false)

	const shareLogFile = () => {
		if (isSharingRef.current) return
		isSharingRef.current = true
		setIsSharing(true)
		void performShareLog(setIsSharing, isSharingRef)
	}

	const menuActions = useMenuActions([
		{
			title: t('ホーム'),
			state: startupScreen === 'home' ? 'on' : 'off',
			onPress: () => setStartupScreen('home'),
		},
		{
			title: t('ライブラリ'),
			state: startupScreen === 'library' ? 'on' : 'off',
			onPress: () => setStartupScreen('library'),
		},
	])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t('一般設定')} />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title={t('起動')}
					first
				/>
				<View style={styles.settingRow}>
					<Text>{t('起動時に開く画面')}</Text>
					<MenuView {...menuActions}>
						<IconButton
							icon='chevron-down'
							size={20}
						/>
					</MenuView>
				</View>
				<View style={styles.settingRow}>
					<Text>{t('言語')}</Text>
					<MenuView {...languageMenuActions}>
						<IconButton
							icon='translate'
							size={20}
						/>
					</MenuView>
				</View>

				<SettingsSectionTitle title={t('プライバシーとデータ')} />
				<View style={styles.settingRow}>
					<Text>{t('データを共有')}</Text>
					<UniversalSwitch
						value={enableDataCollection}
						onValueChange={setEnableDataCollection}
					/>
				</View>

				<SettingsSectionTitle title={t('プレイリストの同期')} />
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>{t('同期時に分割P動画を展開')}</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>{t('分割P動画を個別の曲として展開')}</Text>
					</View>
					<UniversalSwitch
						value={expandMultiPageOnSync ?? false}
						onValueChange={(value) =>
							// 使用 setSettings 方法会跳转到「2025-08-05 播放」的页面？but why？只能先使用 setState
							useAppStore.setState((state) => {
								state.settings.expandMultiPageOnSync = value
								return state
							})
						}
					/>
				</View>

				<SettingsSectionTitle title={t('アップデートとメンテナンス')} />
				<View style={styles.settingRow}>
					<Text>{t('アップデートを確認')}</Text>
					<IconButton
						icon='update'
						size={20}
						loading={isCheckingForUpdate}
						onPress={handleCheckForUpdate}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>{t('今日の動作ログを共有')}</Text>
					<IconButton
						icon='share-variant'
						size={20}
						onPress={shareLogFile}
						loading={isSharing}
						disabled={isSharing}
					/>
				</View>

				<SettingsSectionTitle title={t('開発者')} />
				<View style={styles.settingRow}>
					<Text>{'\u2009Debug\u2009'}{t('ログを有効にする')}</Text>
					<UniversalSwitch
						value={enableDebugLog}
						onValueChange={setEnableDebugLog}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>{t('開発者ページ')}</Text>
					<IconButton
						icon='open-in-new'
						size={20}
						onPress={() => router.navigate('/test')}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>{t('パフォーマンス')}</Text>
					<IconButton
						icon='speedometer'
						size={20}
						onPress={() => router.navigate('/performance')}
					/>
				</View>
			</ScrollView>
		</View>
	)
}

async function performShareLog(
	setIsSharing: (v: boolean) => void,
	isSharingRef: { current: boolean },
) {
	try {
		await flushLogs()
		const d = new Date()
		const dateString = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
		const file = new FileSystem.File(
			FileSystem.Paths.document,
			'logs',
			`${dateString}.log`,
		)
		if (file.exists) {
			await Sharing.shareAsync(file.uri)
		} else {
			toastAndLogError('', new Error(t('无法共有日志：未找到日志文件')), 'UI.Test')
		}
	} catch (e) {
		toastAndLogError('', e, 'UI.Settings')
	} finally {
		setIsSharing(false)
		isSharingRef.current = false
	}
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
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
})
