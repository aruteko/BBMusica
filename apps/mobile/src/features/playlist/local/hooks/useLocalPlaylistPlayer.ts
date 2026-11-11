import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { useCallback } from 'react'
import type { MMKV } from 'react-native-mmkv'
import { useMMKVBoolean } from 'react-native-mmkv'

import { alert } from '@/components/modals/AlertModal'
import { playlistService } from '@/lib/services/playlistService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { storage } from '@/utils/mmkv'
import { addToQueue } from '@/utils/player'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

const SCOPE = 'UI.Playlist.Local.Player'

export function useLocalPlaylistPlayer(
	playlistId: number,
	isOffline?: boolean,
	playableOfflineKeys?: Set<string>,
) {
	const [ignoreAlertReplacePlaylist, setIgnoreAlertReplacePlaylist] =
		useMMKVBoolean('ignore_alert_replace_playlist', storage as MMKV)

	const playAll = useCallback(
		async (startFromId?: string) => {
			const tracksResult = await playlistService.getPlaylistTracks(playlistId)
			if (tracksResult.isErr()) {
				toastAndLogError('プレイリストの内容を取得できませんでした', tracksResult.error, SCOPE)
				return
			}
			let tracks = tracksResult.value.filter((item) =>
				item.source === 'bilibili' ? item.bilibiliMetadata.videoIsValid : true,
			)

			if (isOffline) {
				const originalLength = tracks.length
				const urisToCheck: { uniqueKey: string; uri: string }[] = []
				const keys = new Set<string>()

				for (const track of tracks) {
					if (track.source === 'local') {
						keys.add(track.uniqueKey)
						continue
					}
					const uri = getInternalPlayUri(track)
					if (uri) {
						urisToCheck.push({ uniqueKey: track.uniqueKey, uri })
					}
				}

				const validUris = new Set(
					Orpheus.getLruCachedUris(urisToCheck.map((u) => u.uri)),
				)
				const downloadStatus = await Orpheus.getDownloadStatusByIds(
					urisToCheck.map((u) => u.uniqueKey),
				)

				for (const item of urisToCheck) {
					if (
						validUris.has(item.uri) ||
						downloadStatus?.[item.uniqueKey] === DownloadState.COMPLETED
					) {
						keys.add(item.uniqueKey)
					}
				}

				tracks = tracks.filter((t) => keys.has(t.uniqueKey))

				if (tracks.length === 0) {
					toast.show('オフラインのため、再生できるキャッシュ済みの曲がありません')
					return
				}
				if (tracks.length < originalLength) {
					toast.show('オフラインのため、再生可能なキャッシュ済みの曲のみキューに追加しました')
				}
			}

			if (!tracks || tracks.length === 0) {
				return
			}

			try {
				await addToQueue({
					playlistId,
					tracks: tracks,
					playNow: true,
					clearQueue: true,
					startFromKey: startFromId,
					playNext: false,
				})
			} catch (error) {
				toastAndLogError('すべて再生に失敗しました', error, SCOPE)
			}
		},
		[playlistId, isOffline],
	)

	const handleTrackPress = useCallback(
		(track: Track) => {
			if (
				isOffline &&
				playableOfflineKeys &&
				!playableOfflineKeys.has(track.uniqueKey)
			) {
				toast.show('ネットワークに接続されていないため再生できません。ネットワーク設定を確認してください')
				return
			}
			if (!ignoreAlertReplacePlaylist) {
				alert(
					'プレイリストを置き換え',
					'リスト内の曲をタップすると、現在の再生リストが置き換えられます。続けますか？（次回から表示しない）',
					[
						{ text: 'キャンセル' },
						{
							text: 'OK',
							onPress: () => {
								setIgnoreAlertReplacePlaylist(true)
								void playAll(track.uniqueKey)
							},
						},
					],
					{ cancelable: true },
				)
				return
			}
			void playAll(track.uniqueKey)
		},
		[
			ignoreAlertReplacePlaylist,
			playAll,
			setIgnoreAlertReplacePlaylist,
			isOffline,
			playableOfflineKeys,
		],
	)

	return { playAll, handleTrackPress }
}
