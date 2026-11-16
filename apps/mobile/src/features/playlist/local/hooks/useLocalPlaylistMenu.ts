import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'

import { alert } from '@/components/modals/AlertModal'
import type { TrackMenuItem } from '@/features/playlist/local/components/LocalPlaylistItem'
import { queryClient } from '@/lib/config/queryClient'
import { startStation } from '@/lib/player/station'
import type { Playlist, Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { addToQueue, getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'
import { t } from '@/i18n'

const RADIO_ICON = Icon.select({
	ios: 'dot.radiowaves.left.and.right',
	android: import('@expo/material-symbols/radio.xml'),
})

const PLAY_NEXT_ICON = Icon.select({
	ios: 'arrow.right.to.line.circle',
	android: import('@expo/material-symbols/skip_next.xml'),
})

const ADD_TO_PLAYLIST_ICON = Icon.select({
	ios: 'plus.rectangle.on.rectangle',
	android: import('@expo/material-symbols/playlist_add.xml'),
})

const INFO_ICON = Icon.select({
	ios: 'doc.text',
	android: import('@expo/material-symbols/description.xml'),
})

const ARTIST_ICON = Icon.select({
	ios: 'person.crop.circle',
	android: import('@expo/material-symbols/person.xml'),
})

const DOWNLOAD_ICON = Icon.select({
	ios: 'arrow.down.circle',
	android: import('@expo/material-symbols/download.xml'),
})

const REMOVE_CACHE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete_sweep.xml'),
})

const LINK_ICON = Icon.select({
	ios: 'link',
	android: import('@expo/material-symbols/link.xml'),
})

const EDIT_ICON = Icon.select({
	ios: 'pencil',
	android: import('@expo/material-symbols/edit.xml'),
})

const DELETE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const SCOPE = 'UI.Playlist.Local.Menu'

interface LocalPlaylistMenuProps {
	deleteTrack: (trackId: number) => void
	openAddToPlaylistModal: (track: Track) => void
	openEditTrackModal: (track: Track) => void
	playlist: Playlist | null | undefined
	isReadOnly: boolean
}

export function useLocalPlaylistMenu({
	deleteTrack,
	openAddToPlaylistModal,
	openEditTrackModal,
	playlist,
	isReadOnly,
}: LocalPlaylistMenuProps) {
	const router = useRouter()
	const playlistId = playlist?.id

	const playNext = useCallback(
		async (track: Track) => {
			if (playlistId === undefined) return
			const added = await addToQueue({
				tracks: [track],
				playlistId,
				playNow: false,
				clearQueue: false,
				playNext: true,
			})
			if (added) toast.success(t('次に再生に追加しました'))
		},
		[playlistId],
	)

	const menuFunctions = (
		item: Track,
		downloadState?: DownloadState,
	): TrackMenuItem[] => {
		if (!playlist) return []
		const menuItems: TrackMenuItem[] = [
			{
				title: t('次に再生'),
				leadingIcon: PLAY_NEXT_ICON,
				onPress: () => playNext(item),
				isHighFreq: true,
			},
			{
				title: t('ローカルプレイリストに追加'),
				leadingIcon: ADD_TO_PLAYLIST_ICON,
				onPress: () => openAddToPlaylistModal(item),
				isHighFreq: true,
			},
		]
		if (item.source === 'bilibili') {
			menuItems.push(
				{
					title: t('この曲からステーション'),
					leadingIcon: RADIO_ICON,
					onPress: () => {
						void startStation(item)
					},
				},
				{
					title: t('詳細を表示'),
					leadingIcon: INFO_ICON,
					onPress: () =>
						router.navigate({
							pathname: '/playlist/remote/multipage/[bvid]',
							params: { bvid: item.bilibiliMetadata.bvid },
						}),
				},
				{
					title: t('投稿者の動画を表示'),
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
				{
					title:
						downloadState === DownloadState.COMPLETED ? t('キャッシュを削除') : t('音声をキャッシュ'),
					leadingIcon:
						downloadState === DownloadState.COMPLETED
							? REMOVE_CACHE_ICON
							: DOWNLOAD_ICON,
					onPress: async () => {
						if (downloadState === DownloadState.COMPLETED) {
							await Orpheus.removeDownload(item.uniqueKey)
							toast.success(t('キャッシュを削除しました'))
							await queryClient.invalidateQueries({
								queryKey: ['batchDownloadStatus'],
							})
							return
						}

						try {
							const url = getInternalPlayUri(item)
							if (!url) {
								toastAndLogError(t('内部再生URLを取得できませんでした'), t('失敗しました！'), SCOPE)
								return
							}
							let artistName: string | undefined
							if (item.artist) {
								artistName = item.artist.name
							}
							let artwork: string | undefined
							if (item.coverUrl) {
								artwork = item.coverUrl
							}

							await Orpheus.downloadTrack({
								id: item.uniqueKey,
								url: url,
								title: item.title,
								artist: artistName,
								artwork: artwork,
								duration: item.duration,
							})

							toast.success(t('ダウンロードを開始しました'))
						} catch (error) {
							toastAndLogError(t('音声のキャッシュに失敗しました'), error, SCOPE)
						}
					},
					isHighFreq: true,
				},
			)
		}
		menuItems.push(
			{
				title: t('カバーURLをコピー'),
				leadingIcon: LINK_ICON,
				onPress: () => {
					void Clipboard.setStringAsync(item.coverUrl ?? '')
					toast.success(t('クリップボードにコピーしました'))
				},
			},
			{
				title: t('情報を編集'),
				leadingIcon: EDIT_ICON,
				onPress: () => openEditTrackModal(item),
			},
		)
		if (playlist?.type === 'local' && !isReadOnly) {
			menuItems.push({
				title: t('曲を削除'),
				leadingIcon: DELETE_ICON,
				onPress: () =>
					alert(
						t('確認'),
						t('リストからこの曲を削除しますか？'),
						[
							{
								text: t('キャンセル'),
							},
							{
								text: t('OK'),
								onPress: () => deleteTrack(item.id),
							},
						],
						{
							cancelable: true,
						},
					),
				danger: true,
			})
		}
		return menuItems
	}

	return menuFunctions
}
