import { Orpheus } from '@bbplayer/orpheus'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useSleepTimerEndTime } from '@/hooks/queries/orpheus'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import { formatDurationToHHMMSS } from '@/utils/time'
import toast from '@/utils/toast'

const PRESET_DURATIONS = [15, 30, 45, 60] // in minutes

const SleepTimerModal = () => {
	const close = useModalStore((state) => state.close)
	const { data: sleepTimerEndAt } = useSleepTimerEndTime()
	const [remainingTime, setRemainingTime] = useState<number | null>(null)
	const [customInputVisible, setCustomInputVisible] = useState(false)
	const [customMinutes, setCustomMinutes] = useState('')

	useEffect(() => {
		if (sleepTimerEndAt) {
			const interval = setInterval(() => {
				const remaining = Math.round((sleepTimerEndAt - Date.now()) / 1000)
				if (remaining > 0) {
					setRemainingTime(remaining)
				} else {
					setRemainingTime(null)
					clearInterval(interval)
				}
			}, 1000)
			const remaining = Math.round((sleepTimerEndAt - Date.now()) / 1000)
			setRemainingTime(remaining > 0 ? remaining : null)

			return () => clearInterval(interval)
		} else {
			setRemainingTime(null)
		}
	}, [sleepTimerEndAt])

	const handleSetTimer = async (minutes: number) => {
		try {
			await Orpheus.setSleepTimer(minutes * 60 * 1000)
			toast.success('スリープタイマーを設定しました')
			close('SleepTimer')
		} catch (e) {
			toastAndLogError('スリープタイマーの設定に失敗しました', e, 'Modal.SleepTimer')
		}
	}

	const handleCancelTimer = async () => {
		try {
			await Orpheus.cancelSleepTimer()
			toast.success('スリープタイマーを解除しました')
			close('SleepTimer')
		} catch (e) {
			toastAndLogError('スリープタイマーの解除に失敗しました', e, 'Modal.SleepTimer')
		}
	}

	return (
		<>
			<Dialog.Title>スリープタイマー</Dialog.Title>
			<Dialog.Content>
				{remainingTime ? (
					<View style={styles.remainingTimeContainer}>
						<Text variant='headlineMedium'>
							残り {formatDurationToHHMMSS(remainingTime)}
						</Text>
					</View>
				) : (
					<Text style={styles.promptText}>プリセットの時間を選ぶか、自分で指定してください</Text>
				)}
				<View style={styles.presetContainer}>
					{PRESET_DURATIONS.map((minutes) => (
						<Button
							key={minutes}
							mode='contained-tonal'
							onPress={() => handleSetTimer(minutes)}
							style={styles.presetButton}
						>
							{minutes}
							{'\u2009'}分
						</Button>
					))}
				</View>
				{customInputVisible ? (
					<View style={styles.customInputContainer}>
						<TextInput
							label='分'
							value={customMinutes}
							onChangeText={setCustomMinutes}
							keyboardType='numeric'
							autoFocus
							mode='outlined'
							style={styles.customInput}
						/>
						<Button
							mode='contained'
							onPress={async () => {
								const minutes = parseInt(customMinutes, 10)
								if (!isNaN(minutes) && minutes > 0) {
									await handleSetTimer(minutes)
								}
							}}
						>
							設定
						</Button>
					</View>
				) : (
					<Button
						mode='text'
						onPress={() => setCustomInputVisible(true)}
					>
						カスタム
					</Button>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				{sleepTimerEndAt && (
					<Button
						onPress={handleCancelTimer}
						textColor='red'
					>
						タイマーを解除
					</Button>
				)}
				<Button onPress={() => close('SleepTimer')}>閉じる</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	remainingTimeContainer: {
		alignItems: 'center',
		marginBottom: 16,
	},
	promptText: {
		textAlign: 'center',
		marginBottom: 16,
	},
	presetContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
		marginBottom: 8,
	},
	presetButton: {
		flexBasis: '45%',
		flexGrow: 1,
	},
	customInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	customInput: {
		flex: 1,
		marginRight: 8,
	},
})

export default SleepTimerModal
