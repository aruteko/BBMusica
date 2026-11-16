import { useQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { Track } from '@/types/core/media'
import { t } from '@/i18n'

export const videoStreamKeys = {
	all: ['bilibili', 'videoStream'] as const,
	stream: (bvid: string, cid: number | null) =>
		[...videoStreamKeys.all, bvid, cid] as const,
}

/** 動画の画質。480P（qn=32）。モバイル通信での使いすぎを避けるため、高画質にはしない */
const VIDEO_QUALITY = 32

/**
 * 再生中の曲の動画（MP4）の URL を取得する。
 * 曲のページを開いている間（enabled）だけ取得する。URL には有効期限があるので、
 * キャッシュは短めにしている。
 */
export const useVideoStreamUrl = (track: Track | null, enabled: boolean) => {
	const bvid = track?.source === 'bilibili' ? track.bilibiliMetadata.bvid : null
	const cid = track?.source === 'bilibili' ? track.bilibiliMetadata.cid : null

	return useQuery({
		queryKey: videoStreamKeys.stream(bvid ?? '', cid),
		queryFn: async ({ signal }) => {
			let pageCid = cid
			if (pageCid === null) {
				// 分P でない動画は cid を保存していないので、先頭ページの cid を取得する
				const pages = await bilibiliApi.getPageList({ bvid: bvid!, signal })
				if (pages.isErr()) throw pages.error
				pageCid = pages.value[0]?.cid ?? null
				if (pageCid === null) throw new Error(t('動画のページ情報がありません'))
			}
			const result = await bilibiliApi.getVideoMp4Stream({
				bvid: bvid!,
				cid: pageCid,
				quality: VIDEO_QUALITY,
				signal,
			})
			if (result.isErr()) throw result.error
			return result.value
		},
		enabled: enabled && bvid !== null,
		staleTime: 20 * 60 * 1000,
		retry: false,
		// 失敗しても画面内で表示するので、全体のエラー通知は出さない
		meta: { silent: true },
	})
}
