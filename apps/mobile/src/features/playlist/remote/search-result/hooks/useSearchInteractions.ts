import { Icon } from '@expo/ui'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'

import { MULTIPAGE_VIDEO_KEYWORDS } from '@/features/playlist/remote/search-result/constants'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import { startStation } from '@/lib/player/station'
import type { BilibiliTrack } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

const PLAY_NEXT_ICON = Icon.select({
	ios: 'arrow.right.to.line.circle',
	android: import('@expo/material-symbols/skip_next.xml'),
})

const INFO_ICON = Icon.select({
	ios: 'doc.text',
	android: import('@expo/material-symbols/description.xml'),
})

const ADD_TO_PLAYLIST_ICON = Icon.select({
	ios: 'plus.rectangle.on.rectangle',
	android: import('@expo/material-symbols/playlist_add.xml'),
})

const ARTIST_ICON = Icon.select({
	ios: 'person.crop.circle',
	android: import('@expo/material-symbols/person.xml'),
})

const RADIO_ICON = Icon.select({
	ios: 'dot.radiowaves.left.and.right',
	android: import('@expo/material-symbols/radio.xml'),
})

export function useSearchInteractions() {
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)

	const playTrack = useCallback(
		async (track: BilibiliTrack, playNext = false) => {
			if (
				MULTIPAGE_VIDEO_KEYWORDS.some((keyword) =>
					track.title?.includes(keyword),
				)
			) {
				router.navigate({
					pathname: '/playlist/remote/multipage/[bvid]',
					params: { bvid: track.bilibiliMetadata.bvid },
				})
				return
			}
			const createIt = await syncFacade.addTrackToLocal(track)
			if (createIt.isErr()) {
				toastAndLogError(
					'曲のローカル登録に失敗しました',
					createIt.error,
					'UI.Playlist.Remote',
				)
				reportErrorToSentry(
					createIt.error,
					'曲のローカル登録に失敗しました',
					'UI.Playlist.Remote',
				)
				return
			}
			const added = await addToQueue({
				tracks: [track],
				playNow: !playNext,
				clearQueue: false,
				playNext: playNext,
				startFromKey: track.uniqueKey,
			})
			if (added && playNext) {
				toast.success('次に再生に追加しました')
			}
		},
		[router],
	)

	const trackMenuItems = useCallback(
		(item: BilibiliTrack) => [
			{
				title: 'この曲からステーション',
				leadingIcon: RADIO_ICON,
				onPress: () => {
					void startStation(item)
				},
			},
			{
				title: '次に再生',
				leadingIcon: PLAY_NEXT_ICON,
				onPress: () => playTrack(item, true),
			},
			{
				title: '詳細を表示',
				leadingIcon: INFO_ICON,
				onPress: () => {
					router.navigate({
						pathname: '/playlist/remote/multipage/[bvid]',
						params: { bvid: item.bilibiliMetadata.bvid },
					})
				},
			},
			{
				title: 'ローカルプレイリストに追加',
				leadingIcon: ADD_TO_PLAYLIST_ICON,
				onPress: () => {
					openModal('UpdateTrackLocalPlaylists', { track: item })
				},
			},
			{
				title: '投稿者の動画を表示',
				leadingIcon: ARTIST_ICON,
				onPress: () => {
					if (!item.artist?.remoteId) {
						return
					}
					router.navigate({
						pathname: '/playlist/remote/uploader/[mid]',
						params: { mid: item.artist?.remoteId },
					})
				},
			},
		],
		[router, openModal, playTrack],
	)

	return {
		playTrack,
		trackMenuItems,
	}
}
