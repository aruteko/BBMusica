import { Orpheus } from '@bbplayer/orpheus'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
	useGetVideoIsThumbUp,
	videoDataQueryKeys,
} from '@/hooks/queries/bilibili/video'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { toastAndLogError } from '@/utils/error-handling'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import toast from '@/utils/toast'
import { t } from '@/i18n'

/**
 * ハートのボタン：動画に、いいね（高評価）をする / 取り消す。
 * Web 版と同じ内容で送るため、いま再生している位置と、再生中かどうかも一緒に送る。
 */
export function useThumbUp(bvid: string | undefined) {
	const queryClient = useQueryClient()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	const { data: thumbState, isPending } = useGetVideoIsThumbUp(bvid)
	const isLiked = thumbState === 1

	const mutation = useMutation({
		mutationFn: async (like: boolean) => {
			if (!bvid) throw new Error(t('動画の情報がありません'))
			const [playedSeconds, isPlaying] = await Promise.all([
				Orpheus.getPosition().catch(() => 0),
				Orpheus.getIsPlaying().catch(() => false),
			])
			await returnOrThrowAsync(
				bilibiliApi.thumbUpVideo({ bvid, like, playedSeconds, isPlaying }),
			)
			return like
		},
		onSuccess: (like) => {
			queryClient.setQueryData(videoDataQueryKeys.getVideoIsThumbUp(bvid), like ? 1 : 0)
			toast.success(like ? t('いいねしました') : t('いいねを取り消しました'))
		},
		onError: (error, like) => {
			toastAndLogError(
				like ? t('いいねに失敗しました') : t('いいねの取り消しに失敗しました'),
				error,
				'UI.Player',
			)
		},
	})

	return {
		hasCookie,
		isLiked,
		isLoading: hasCookie && (isPending || mutation.isPending),
		toggle: (onLiked?: () => void) => {
			if (!hasCookie) {
				toast.error(t('ログインが必要です'))
				return
			}
			if (mutation.isPending) return
			mutation.mutate(!isLiked, {
				onSuccess: (liked) => {
					if (liked) onLiked?.()
				},
			})
		},
	}
}
