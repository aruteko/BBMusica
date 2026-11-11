import { Divider, List } from 'react-native-paper'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { startStation } from '@/lib/player/station'

import {
	HighFreqButton,
	HighFreqRow,
	PlayerDownloadButton,
	PlayerModeSwitch,
	SharedTrackActions,
	ShareSongAction,
	type PlayerMenuContentProps,
} from './PlayerMenuContent'

export function MusicFunctionalMenu({
	onAction: handleAction,
}: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)
	return (
		<>
			<HighFreqRow style={{ paddingBottom: 12 }}>
				<HighFreqButton
					icon='speedometer'
					label='再生速度'
					onPress={() =>
						handleAction(() => openModal('PlaybackSpeed', undefined))
					}
				/>
				<HighFreqButton
					icon='timer-outline'
					label='スリープタイマー'
					onPress={() => handleAction(() => openModal('SleepTimer', undefined))}
				/>
				<PlayerDownloadButton onAction={handleAction} />
			</HighFreqRow>
			<PlayerModeSwitch onAction={handleAction} />
			<Divider />
			<SharedTrackActions onAction={handleAction} />
			<List.Item
				title='ステーションを開始（この曲をもとに）'
				left={(props) => (
					<List.Icon
						{...props}
						icon='radio-tower'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						void startStation(currentTrack)
					})
				}
			/>
			<List.Item
				title='歌詞を検索'
				left={(props) => (
					<List.Icon
						{...props}
						icon='magnify'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						openModal('ManualSearchLyrics', {
							uniqueKey: currentTrack.uniqueKey,
							initialQuery: currentTrack.title,
						})
					})
				}
			/>
			<List.Item
				title='歌詞を共有'
				left={(props) => (
					<List.Icon
						{...props}
						icon='share-variant'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						openModal('LyricsSelection', undefined)
					})
				}
			/>
			<ShareSongAction onAction={handleAction} />
		</>
	)
}
