import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import { usePlaybackOptions } from '@/hooks/player/usePlaybackOptions'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerChaptersSheetStore } from '@/hooks/stores/usePlayerChaptersSheetStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { formatDurationToHHMMSS } from '@/utils/time'

import {
	MainPlaybackControls,
	SecondaryPlaybackControls,
} from './PlayerControlContent'
import { t } from '@/i18n'

export function PodcastControls({ compact = false }: { compact?: boolean }) {
	const { colors } = useTheme()
	const { speed, sleepEndTime } = usePlaybackOptions()
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (!sleepEndTime) return
		const interval = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(interval)
	}, [sleepEndTime])
	const remaining = sleepEndTime
		? Math.max(0, Math.ceil((sleepEndTime - now) / 1000))
		: 0
	const actions = [
		{
			icon: 'speedometer',
			accessibilityLabel: `${t('再生速度、現在 ')}${speed} 倍`,
			onPress: () => useModalStore.getState().open('PlaybackSpeed', undefined),
		},
		{
			icon: 'timer-outline',
			accessibilityLabel:
				remaining > 0
					? `${t('スリープタイマー、残り ')}${formatDurationToHHMMSS(remaining)}`
					: t('スリープタイマー'),
			onPress: () => useModalStore.getState().open('SleepTimer', undefined),
		},
		{
			icon: 'book-open-page-variant-outline',
			accessibilityLabel: t('チャプター一覧を開く'),
			onPress: () => {
				void usePlayerChaptersSheetStore.getState().open()
			},
		},
		{
			icon: 'format-list-bulleted',
			accessibilityLabel: t('再生キューを開く'),
			onPress: () => {
				void usePlayerQueueSheetStore.getState().open()
			},
		},
	]
	return (
		<View>
			<View style={{ marginTop: compact ? 8 : 24 }}>
				<MainPlaybackControls
					podcast
					size={compact ? 'compact' : 'normal'}
				/>
			</View>
			<SecondaryPlaybackControls compact={compact}>
				{actions.map((action) => (
					<IconButton
						key={action.icon}
						icon={action.icon}
						size={24}
						iconColor={colors.onSurfaceVariant}
						onPress={action.onPress}
						accessibilityLabel={action.accessibilityLabel}
					/>
				))}
			</SecondaryPlaybackControls>
		</View>
	)
}
