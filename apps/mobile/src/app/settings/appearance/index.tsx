import { Orpheus, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import {
	PermissionsAndroid,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import ThemeSection from '@/features/theme/ThemeSection'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'

export default function AppearanceSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const playerBackgroundStyle = useAppStore((state) =>
		state.settings.playerBackgroundStyle === 'fluid' ? 'fluid' : 'gradient',
	)
	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
	)
	const enableSpectrumVisualizer = useSpectrumVisualizerEnabled()
	const setSettings = useAppStore((state) => state.setSettings)
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)

	const nowPlayingBarStyleMenu = useMenuActions([
		{
			title: 'フローティング（既定）',
			state: nowPlayingBarStyle === 'float' ? 'on' : 'off',
			onPress: () => setSettings({ nowPlayingBarStyle: 'float' }),
		},
		{
			title: '没入',
			state: nowPlayingBarStyle === 'bottom' ? 'on' : 'off',
			onPress: () => setSettings({ nowPlayingBarStyle: 'bottom' }),
		},
	])

	const playerBackgroundStyleMenu = useMenuActions([
		{
			title: '流体エフェクト（既定）',
			state: playerBackgroundStyle === 'fluid' ? 'on' : 'off',
			onPress: () => setSettings({ playerBackgroundStyle: 'fluid' }),
		},
		{
			title: '通常のグラデーション',
			state: playerBackgroundStyle === 'gradient' ? 'on' : 'off',
			onPress: () => setSettings({ playerBackgroundStyle: 'gradient' }),
		},
	])

	const handleSpectrumToggle = () => {
		if (enableSpectrumVisualizer) {
			Orpheus.isSpectrumVisualizerEnabled = false
			return
		}

		if (Platform.OS === 'android') {
			void PermissionsAndroid.check(
				PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
			).then((hasPermission) => {
				if (hasPermission) {
					Orpheus.isSpectrumVisualizerEnabled = true
				} else {
					alert(
						'マイクの権限が必要です',
						'音声スペクトラムは、音声データを分析するためにマイクへのアクセスが必要です。音を録音することはありません。',
						[
							{ text: 'キャンセル' },
							{
								text: '確認',
								onPress: () => {
									void PermissionsAndroid.request(
										PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
									).then((granted) => {
										if (granted === PermissionsAndroid.RESULTS.GRANTED) {
											Orpheus.isSpectrumVisualizerEnabled = true
										}
									})
								},
							},
						],
						{ cancelable: true },
					)
				}
			})
		} else {
			Orpheus.isSpectrumVisualizerEnabled = true
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='外観とテーマ' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title='表示'
					first
				/>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>純白の背景</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							電子ペーパー向け
						</Text>
					</View>
					<UniversalSwitch
						value={pureWhiteBackground}
						onValueChange={(value) =>
							setSettings({ pureWhiteBackground: value })
						}
						testID='pure-white-background-switch'
					/>
				</View>
				<SettingsSectionTitle title='プレーヤー' />
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>音声スペクトラムを表示</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							プレーヤーのカバーの周りにリアルタイムの音声スペクトラムを表示します
						</Text>
					</View>
					<UniversalSwitch
						value={enableSpectrumVisualizer}
						onValueChange={handleSpectrumToggle}
					/>
				</View>
				{Platform.OS === 'android' && (
					<View style={styles.settingRow}>
						<Text>下部の再生バーのスタイルを選択</Text>
						<MenuView {...nowPlayingBarStyleMenu}>
							<IconButton
								icon='palette'
								size={20}
							/>
						</MenuView>
					</View>
				)}
				<View style={styles.settingRow}>
					<Text>プレーヤーの背景スタイルを選択</Text>
					<MenuView {...playerBackgroundStyleMenu}>
						<IconButton
							icon='palette'
							size={20}
						/>
					</MenuView>
				</View>

				<SettingsSectionTitle title='テーマ' />
				<ThemeSection disabled={pureWhiteBackground} />
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
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
})
