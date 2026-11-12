import { useMutation, useQueryClient } from '@tanstack/react-query'

import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import toast from '@/utils/toast'

const logger = log.extend('Mutation.Bilibili.Favorite')

/**
 * 单个视频添加/删除到多个收藏夹
 */
export const useDealFavoriteForOneVideo = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (params: {
			bvid: string
			addToFavoriteIds: string[]
			delInFavoriteIds: string[]
		}) =>
			await returnOrThrowAsync(
				bilibiliApi.dealFavoriteForOneVideo({
					bvid: params.bvid,
					addToFavoriteIds: params.addToFavoriteIds,
					delInFavoriteIds: params.delInFavoriteIds,
				}),
			),
		onSuccess: async (_data, _value) => {
			toast.success('操作しました', {
				description:
					_data.toast_msg.length > 0
						? `APIからのメッセージ：${_data.toast_msg}`
						: undefined,
			})
			// 只刷新当前显示的收藏夹
			await queryClient.refetchQueries({
				queryKey: ['bilibili', 'favoriteList', 'infiniteFavoriteList'],
				type: 'active',
			})
		},
		onError: (error) => {
			let errorMessage = '削除に失敗しました。しばらくしてからお試しください'
			if (error instanceof BilibiliApiError) {
				if (error.type === 'CsrfError') {
					errorMessage = '削除に失敗しました：csrfトークンの有効期限が切れています。Cookieを確認してから、もう一度お試しください'
				} else {
					errorMessage = `削除に失敗しました：${error.message} (${error.data.msgCode})`
				}
			}

			toast.error('操作に失敗しました', {
				description: errorMessage,
				duration: Number.POSITIVE_INFINITY,
			})
			logger.error('删除收藏夹内容失败:', error)
		},
	})
}

/**
 * 删除收藏夹内容
 */
export const useBatchDeleteFavoriteListContents = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (params: { bvids: string[]; favoriteId: number }) =>
			returnOrThrowAsync(
				bilibiliApi.batchDeleteFavoriteListContents({
					favoriteId: params.favoriteId,
					bvids: params.bvids,
				}),
			),
		onSuccess: async (_data, variables) => {
			toast.success('削除しました')
			await queryClient.refetchQueries({
				queryKey: favoriteListQueryKeys.infiniteFavoriteList(
					variables.favoriteId,
				),
			})
		},
		onError: (error) => {
			let errorMessage = '削除に失敗しました。しばらくしてからお試しください'
			if (error instanceof BilibiliApiError) {
				if (error.type === 'CsrfError') {
					errorMessage = '削除に失敗しました：csrfトークンの有効期限が切れています。Cookieを確認してから、もう一度お試しください'
				} else {
					errorMessage = `削除に失敗しました：${error.message} (${error.data.msgCode})`
				}
			}

			toastAndLogError(errorMessage, error, 'Query.Bilibili.Favorite')
		},
	})
}
