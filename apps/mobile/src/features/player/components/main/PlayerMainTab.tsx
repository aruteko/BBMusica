import { Show, useValue } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	/** このページが表示中か（MVを読み込むかどうか） */
	active?: boolean
	/**
	 * 丸いカバーの部分を MV（動画）にしたページ。
	 * 歌詞のページと同じく、プレーヤーのページャーの1ページとして並べる
	 * （どこをなぞっても、ネイティブのページャーの動きで切り替わる）。
	 */
	videoMode?: boolean
	onPresent: () => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	active = true,
	videoMode = false,
	onPresent,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const mode = useValue(playbackContextStore$.context.mode)
	const [size, setSize] = useState({ width: 0, height: 0 })
	const compact = size.height - insets.bottom < 600 || size.width < 360

	if (!currentTrack) return null
	return (
		<Show if={playbackContextStore$.ready}>
			<View
				style={styles.container}
				onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
			>
				<View style={styles.trackInfoArea}>
					<TrackInfo
						onArtistPress={() =>
							currentTrack.artist?.remoteId
								? router.navigate({
										pathname: '/playlist/remote/uploader/[mid]',
										params: { mid: currentTrack.artist?.remoteId },
									})
								: void 0
						}
						onPressCover={() => {
							void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
							jumpTo('lyrics')
						}}
						coverRef={imageRef}
						active={active}
						showVideo={videoMode}
					/>
				</View>

				<View
					style={[
						{ paddingBottom: insets.bottom + (compact ? 8 : 20) },
						styles.controlsContainer,
					]}
				>
					{mode === 'podcast' && (
						<Button
							icon='subtitles-outline'
							onPress={() => jumpTo('lyrics')}
							compact
						>
							字幕
						</Button>
					)}
					<PlayerSlider />
					<PlayerControls
						compact={compact}
						onOpenQueue={() => {
							onPresent()
							void usePlayerQueueSheetStore.getState().open()
						}}
					/>
				</View>
			</View>
		</Show>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		minHeight: 0,
	},
	trackInfoArea: {
		flex: 1,
		minHeight: 0,
	},
	controlsContainer: {
		flexShrink: 0,
		paddingTop: 8,
		paddingHorizontal: 24,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
