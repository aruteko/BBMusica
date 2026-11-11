import { Orpheus, type EqualizerInfo } from '@bbplayer/orpheus'
import { Slider } from '@expo/ui/community/slider'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Chip, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { toastAndLogError } from '@/utils/error-handling'

const SCOPE = 'UI.Settings.Equalizer'

function formatFrequency(hz: number) {
	return hz >= 1000 ? `${Number((hz / 1000).toFixed(1))} kHz` : `${hz} Hz`
}

function formatLevel(millibel: number) {
	const db = millibel / 100
	return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`
}

export default function EqualizerSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const [info, setInfo] = useState<EqualizerInfo | null>(null)
	const [levels, setLevels] = useState<Record<number, number>>({})

	const load = useCallback(async () => {
		if (Platform.OS !== 'android') return
		try {
			const result = await Orpheus.getEqualizerInfo()
			setInfo(result)
			setLevels(
				Object.fromEntries(
					(result.bands ?? []).map((band) => [band.index, band.level]),
				),
			)
		} catch (error) {
			toastAndLogError('イコライザーの読み込みに失敗しました', error, SCOPE)
		}
	}, [])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const handleToggle = async (enabled: boolean) => {
		try {
			await Orpheus.setEqualizerEnabled(enabled)
			setInfo((prev) => (prev ? { ...prev, enabled } : prev))
		} catch (error) {
			toastAndLogError('イコライザーの切り替えに失敗しました', error, SCOPE)
		}
	}

	const handleBandChange = (band: number, level: number) => {
		const rounded = Math.round(level)
		setLevels((prev) => ({ ...prev, [band]: rounded }))
		void Orpheus.setEqualizerBandLevel(band, rounded).catch((error) =>
			toastAndLogError('バンドの設定に失敗しました', error, SCOPE),
		)
	}

	const handlePreset = async (index: number) => {
		try {
			await Orpheus.applyEqualizerPreset(index)
			await load()
		} catch (error) {
			toastAndLogError('プリセットの適用に失敗しました', error, SCOPE)
		}
	}

	const handleReset = async () => {
		try {
			await Orpheus.resetEqualizer()
			await load()
		} catch (error) {
			toastAndLogError('リセットに失敗しました', error, SCOPE)
		}
	}

	let body: React.ReactNode
	if (Platform.OS !== 'android') {
		body = (
			<Text style={styles.notice}>
				イコライザーは Android でのみ利用できます。
			</Text>
		)
	} else if (!info) {
		body = null
	} else if (!info.available) {
		body = (
			<View>
				<Text style={styles.notice}>
					イコライザーは、曲の再生を開始したあとに設定できます。何か1曲を再生してから、この画面を開き直してください。
				</Text>
				<Button
					mode='outlined'
					onPress={() => void load()}
				>
					再読み込み
				</Button>
			</View>
		)
	} else {
		const minLevel = info.minLevel ?? -1500
		const maxLevel = info.maxLevel ?? 1500
		body = (
			<View>
				<View style={styles.settingRow}>
					<Text>イコライザーを有効にする</Text>
					<UniversalSwitch
						value={info.enabled}
						onValueChange={(value) => void handleToggle(value)}
					/>
				</View>

				{info.presets && info.presets.length > 0 && (
					<>
						<SettingsSectionTitle title='プリセット' />
						<View style={styles.presets}>
							{info.presets.map((name, index) => (
								<Chip
									key={name}
									mode='outlined'
									style={styles.chip}
									onPress={() => void handlePreset(index)}
								>
									{name}
								</Chip>
							))}
						</View>
					</>
				)}

				<SettingsSectionTitle title='バンド' />
				{(info.bands ?? []).map((band) => {
					const level = levels[band.index] ?? band.level
					return (
						<View
							key={band.index}
							style={styles.bandRow}
						>
							<View style={styles.bandLabel}>
								<Text variant='bodyMedium'>
									{formatFrequency(band.centerFreq)}
								</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									{formatLevel(level)}
								</Text>
							</View>
							<Slider
								style={styles.slider}
								minimumValue={minLevel}
								maximumValue={maxLevel}
								step={50}
								value={level}
								onValueChange={(value) => handleBandChange(band.index, value)}
							/>
						</View>
					)
				})}

				<View style={styles.resetRow}>
					<Button
						mode='outlined'
						icon='restore'
						onPress={() => void handleReset()}
					>
						フラットに戻す
					</Button>
				</View>
			</View>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='イコライザー' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				{body}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollView: { flex: 1 },
	scrollContent: { paddingHorizontal: 25 },
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
	notice: { marginVertical: 16 },
	presets: { flexDirection: 'row', flexWrap: 'wrap' },
	chip: { marginRight: 8, marginBottom: 8 },
	bandRow: { marginTop: 8 },
	bandLabel: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	slider: { width: '100%', height: 40 },
	resetRow: { marginTop: 24, alignItems: 'flex-start' },
})
