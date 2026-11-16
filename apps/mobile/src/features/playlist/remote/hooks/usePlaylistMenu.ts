import { Icon } from '@expo/ui'
import { usePathname, useRouter } from 'expo-router'
import { useCallback } from 'react'

import { useModalStore } from '@/hooks/stores/useModalStore'
import { startStation } from '@/lib/player/station'
import type { BilibiliTrack } from '@/types/core/media'
import toast from '@/utils/toast'
import { t } from '@/i18n'

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

export function usePlaylistMenu(
	playTrack: (track: BilibiliTrack, playNext: boolean) => void,
) {
	const router = useRouter()
	const pathname = usePathname()
	const openModal = useModalStore((state) => state.open)

	return useCallback(
		(item: BilibiliTrack) => [
			{
				title: t('次に再生'),
				leadingIcon: PLAY_NEXT_ICON,
				onPress: () => {
					playTrack(item, true)
					toast.success(t('次に再生に追加しました'))
				},
			},
			{
				title: t('詳細を表示'),
				leadingIcon: INFO_ICON,
				onPress: () => {
					if (pathname.includes('multipage')) {
						toast.info(t('すでにここにいます。これ以上は深く進めません！'))
						return
					}
					router.navigate({
						pathname: '/playlist/remote/multipage/[bvid]',
						params: { bvid: item.bilibiliMetadata.bvid },
					})
				},
			},
			{
				title: t('この曲からステーション'),
				leadingIcon: RADIO_ICON,
				onPress: () => {
					void startStation(item)
				},
			},
			{
				title: t('ローカルプレイリストに追加'),
				leadingIcon: ADD_TO_PLAYLIST_ICON,
				onPress: () => {
					openModal('UpdateTrackLocalPlaylists', { track: item })
				},
			},
			{
				title: t('投稿者の動画を表示'),
				leadingIcon: ARTIST_ICON,
				onPress: () => {
					if (!item.artist?.remoteId) {
						toast.error(t('投稿者の情報が見つかりません'))
						return
					}
					router.navigate({
						pathname: '/playlist/remote/uploader/[mid]',
						params: { mid: item.artist?.remoteId },
					})
				},
			},
		],
		[router, openModal, playTrack, pathname],
	)
}
