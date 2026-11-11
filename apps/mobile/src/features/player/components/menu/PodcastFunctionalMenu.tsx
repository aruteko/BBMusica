import { RepeatMode } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { Divider, List, useTheme } from 'react-native-paper'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	usePlaybackOptions,
	setPlayerRepeatMode,
	setPlayerShuffleMode,
} from '@/hooks/player/usePlaybackOptions'
import { toastAndLogError } from '@/utils/error-handling'

import {
	HighFreqButton,
	HighFreqRow,
	PlayerDownloadButton,
	PlayerModeSwitch,
	SharedTrackActions,
	ShareSongAction,
	type PlayerMenuContentProps,
} from './PlayerMenuContent'

export function PodcastFunctionalMenu({ onAction }: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const router = useRouter()
	return (
		<>
			<HighFreqRow style={{ paddingBottom: 12 }}>
				<PlayerDownloadButton onAction={onAction} />
				{currentTrack?.source === 'bilibili' && (
					<HighFreqButton
						label='コメント'
						icon='comment-text-outline'
						onPress={() =>
							onAction(() =>
								router.navigate({
									pathname: '/comments/[bvid]',
									params: { bvid: currentTrack.bilibiliMetadata.bvid },
								}),
							)
						}
					/>
				)}
			</HighFreqRow>
			<PlayerModeSwitch onAction={onAction} />
			<PodcastPlaybackSettings />
			<Divider />
			<SharedTrackActions onAction={onAction} />
			<ShareSongAction onAction={onAction} />
		</>
	)
}

const report = (error: unknown) =>
	toastAndLogError('再生設定の更新に失敗しました', error, 'Player.Mode')

function PodcastPlaybackSettings() {
	const { shuffle, repeat } = usePlaybackOptions()
	const { colors } = useTheme()
	return (
		<>
			<List.Item
				title='シャッフル'
				description={shuffle ? 'オン' : 'オフ'}
				left={(props) => (
					<List.Icon
						{...props}
						icon={shuffle ? 'shuffle-variant' : 'shuffle-disabled'}
						color={shuffle ? colors.primary : colors.onSurfaceVariant}
					/>
				)}
				onPress={() => {
					void setPlayerShuffleMode(!shuffle).catch(report)
				}}
			/>
			<List.Item
				title='リピートモード'
				description={
					repeat === RepeatMode.OFF
						? 'リピートなし'
						: repeat === RepeatMode.TRACK
							? '1曲リピート'
							: 'キューをリピート'
				}
				left={(props) => (
					<List.Icon
						{...props}
						icon={
							repeat === RepeatMode.OFF
								? 'repeat-off'
								: repeat === RepeatMode.TRACK
									? 'repeat-once'
									: 'repeat'
						}
						color={
							repeat !== RepeatMode.OFF
								? colors.primary
								: colors.onSurfaceVariant
						}
					/>
				)}
				onPress={() => {
					const next =
						repeat === RepeatMode.OFF
							? RepeatMode.TRACK
							: repeat === RepeatMode.TRACK
								? RepeatMode.QUEUE
								: RepeatMode.OFF
					void setPlayerRepeatMode(next).catch(report)
				}}
			/>
		</>
	)
}
