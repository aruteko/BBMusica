import { useMutation } from '@tanstack/react-query'

import { videoDataQueryKeys } from '@/hooks/queries/bilibili/video'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { BilibiliToViewVideoList } from '@/types/apis/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import toast from '@/utils/toast'
import { t } from '@/i18n'

export const useDeleteToViewVideo = () => {
	return useMutation({
		mutationFn: ({
			deleteAllViewed,
			avid,
		}: {
			deleteAllViewed?: boolean
			avid?: number
		}) =>
			returnOrThrowAsync(
				bilibiliApi
					.deleteToViewVideo({ deleteAllViewed, avid })
					.map(() => true),
			),
		onMutate: async ({ deleteAllViewed, avid }, context) => {
			await context.client.cancelQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
			const previousData = context.client.getQueryData(
				videoDataQueryKeys.getToViewVideoList(),
			)
			context.client.setQueryData(
				videoDataQueryKeys.getToViewVideoList(),
				(oldData: BilibiliToViewVideoList) => {
					if (!oldData) return undefined
					if (deleteAllViewed) {
						const newItems = oldData.list.filter((item) => item.progress !== -1)
						return {
							count: newItems.length,
							list: newItems,
						}
					} else {
						const newItems = oldData.list.filter((item) => item.aid !== avid)
						return {
							count: newItems.length,
							list: newItems,
						}
					}
				},
			)
			return { previousData }
		},
		onSettled: async (
			_d,
			error,
			{ deleteAllViewed },
			onMutateResult,
			context,
		) => {
			if (error) {
				toastAndLogError(
					deleteAllViewed ? t('あとで見るの消去に失敗しました') : t('削除に失敗しました'),
					error,
					'Mutation.Bilibili.Video',
				)
				context.client.setQueryData(
					videoDataQueryKeys.getToViewVideoList(),
					onMutateResult?.previousData,
				)
			} else {
				toast.success(deleteAllViewed ? t('あとで見るを消去しました') : t('削除しました'))
			}
			await context.client.invalidateQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
		},
	})
}

export const useClearToViewVideoList = () => {
	return useMutation({
		mutationFn: () =>
			returnOrThrowAsync(bilibiliApi.clearToViewVideoList().map(() => true)),
		// onSuccess: () => {
		// 	queryClient.setQueryData(videoDataQueryKeys.getToViewVideoList(), {
		// 		count: 0,
		// 		list: [],
		// 	})
		// 	toast.success('清除稍后再看列表成功')
		// },
		// onError: (err) => {
		// 	toastAndLogError('清除稍后再看列表失败', err, 'UI.Player')
		// },
		onMutate: async (_, context) => {
			await context.client.cancelQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
			const previousData = context.client.getQueryData(
				videoDataQueryKeys.getToViewVideoList(),
			)
			context.client.setQueryData(videoDataQueryKeys.getToViewVideoList(), {
				count: 0,
				list: [],
			})
			return { previousData }
		},
		onSettled: async (_d, error, _v, onMutateResult, context) => {
			if (error) {
				toastAndLogError(
					t('あとで見るの消去に失敗しました'),
					error,
					'Mutation.Bilibili.Video',
				)
				context.client.setQueryData(
					videoDataQueryKeys.getToViewVideoList(),
					onMutateResult?.previousData,
				)
			} else {
				toast.success(t('あとで見るを消去しました'))
			}
			await context.client.invalidateQueries({
				queryKey: videoDataQueryKeys.getToViewVideoList(),
			})
		},
	})
}
