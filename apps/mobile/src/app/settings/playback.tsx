import { Orpheus } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Text, TouchableRipple, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import { toastAndLogError } from '@/utils/error-handling'

export default function PlaybackSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const allowSimultaneousPlayback = useAppStore(
		(state) => state.settings.allowSimultaneousPlayback,
	)
	const defaultPlayerMode = useAppStore(
		(state) => state.settings.defaultPlayerMode,
	)
	const autoPlayRecommendations = useAppStore(
		// 旧版本保存的设置里没有这个字段，视为开启
		(state) => state.settings.autoPlayRecommendations !== false,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const [enablePersistCurrentPosition, setEnablePersistCurrentPosition] =
		useState(Orpheus.restorePlaybackPositionEnabled)
	const [enableLoudnessNormalization, setEnableLoudnessNormalization] =
		useState(Orpheus.loudnessNormalizationEnabled)
	const [enableLeadingSilenceSkip, setEnableLeadingSilenceSkip] = useState(
		Orpheus.isLeadingSilenceSkipEnabled,
	)
	const [enableAutostartPlayOnStart, setEnableAutostartPlayOnStart] = useState(
		Orpheus.autoplayOnStartEnabled,
	)

	const setDefaultPlayerMode = (mode: 'music' | 'podcast') => {
		setSettings({ defaultPlayerMode: mode })
	}

	const menuActions = useMenuActions([
		{
			title: '音楽',
			state: defaultPlayerMode === 'music' ? 'on' : 'off',
			onPress: () => setDefaultPlayerMode('music'),
		},
		{
			title: 'ポッドキャスト',
			state: defaultPlayerMode === 'podcast' ? 'on' : 'off',
			onPress: () => setDefaultPlayerMode('podcast'),
		},
	])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='再生設定' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<SettingsSectionTitle
					title='再生の動作'
					first
				/>
				<View style={styles.settingRow}>
					<View style={{ flexShrink: 1 }}>
						<Text>デフォルトのプレーヤー</Text>
						<Text variant='bodySmall'>
							これから始める再生にのみ影響します。プレイリストごとに個別の設定もできます。
						</Text>
					</View>
					<MenuView {...menuActions}>
						<IconButton
							icon='chevron-down'
							size={20}
						/>
					</MenuView>
				</View>
				<View style={styles.settingRow}>
					<Text>音量の自動調整</Text>
					<UniversalSwitch
						value={enableLoudnessNormalization}
						onValueChange={() => {
							try {
								Orpheus.loudnessNormalizationEnabled =
									!enableLoudnessNormalization
							} catch (e) {
								toastAndLogError('設定に失敗しました', e, 'Settings')
								return
							}
							setEnableLoudnessNormalization(!enableLoudnessNormalization)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<View style={{ flexShrink: 1, paddingRight: 12 }}>
						<Text>曲の冒頭の無音をスキップ</Text>
						<Text variant='bodySmall'>
							曲の始まりにある無音部分だけを飛ばします（最大6秒）。曲の途中の無音は飛ばしません。
						</Text>
					</View>
					<UniversalSwitch
						value={enableLeadingSilenceSkip}
						onValueChange={() => {
							try {
								Orpheus.isLeadingSilenceSkipEnabled = !enableLeadingSilenceSkip
							} catch (e) {
								toastAndLogError('設定に失敗しました', e, 'Settings')
								return
							}
							setEnableLeadingSilenceSkip(!enableLeadingSilenceSkip)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>他のアプリと同時に再生を許可</Text>
					<UniversalSwitch
						value={allowSimultaneousPlayback}
						onValueChange={(value) => {
							setSettings({ allowSimultaneousPlayback: value })
						}}
					/>
				</View>

				<View style={styles.settingRow}>
					<View style={{ flexShrink: 1, paddingRight: 12 }}>
						<Text>キュー終了時におすすめを自動再生</Text>
						<Text variant='bodySmall'>
							再生リストが最後まで終わったら、似た曲を続けて再生します。
						</Text>
					</View>
					<UniversalSwitch
						value={autoPlayRecommendations}
						onValueChange={(value) => {
							setSettings({ autoPlayRecommendations: value })
						}}
					/>
				</View>
				<TouchableRipple
					onPress={() => router.navigate('/settings/equalizer')}
					accessibilityLabel='イコライザー'
				>
					<View style={styles.settingRow}>
						<Text>イコライザー</Text>
						<IconButton
							icon='chevron-right'
							size={20}
						/>
					</View>
				</TouchableRipple>

				<SettingsSectionTitle title='起動時の動作' />
				<View style={styles.settingRow}>
					<Text>アプリ起動時に前回の再生位置を復元</Text>
					<UniversalSwitch
						value={enablePersistCurrentPosition}
						onValueChange={() => {
							try {
								Orpheus.restorePlaybackPositionEnabled =
									!enablePersistCurrentPosition
							} catch (e) {
								toastAndLogError('設定に失敗しました', e, 'Settings')
								return
							}
							setEnablePersistCurrentPosition(!enablePersistCurrentPosition)
						}}
					/>
				</View>
				<View style={styles.settingRow}>
					<Text>アプリ起動時に自動で再生</Text>
					<UniversalSwitch
						value={enableAutostartPlayOnStart}
						onValueChange={() => {
							try {
								Orpheus.autoplayOnStartEnabled = !enableAutostartPlayOnStart
							} catch (e) {
								toastAndLogError('設定に失敗しました', e, 'Settings')
								return
							}
							setEnableAutostartPlayOnStart(!enableAutostartPlayOnStart)
						}}
					/>
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
