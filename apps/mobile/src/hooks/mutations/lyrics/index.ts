import { useMutation } from '@tanstack/react-query'

import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { LyricSearchResult } from '@/types/player/lyrics'
import toast from '@/utils/toast'
import { t } from '@/i18n'

export const useFetchLyrics = () => {
	return useMutation({
		mutationKey: ['lyrics', 'fetchLyrics'],
		mutationFn: async ({
			uniqueKey,
			item,
		}: {
			uniqueKey: string
			item: LyricSearchResult[0]
		}) => {
			const result = await lyricService.fetchLyrics(item, uniqueKey)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: (_, { uniqueKey }) => {
			toast.show(t('歌詞を取得しました'))
			void queryClient.invalidateQueries({
				queryKey: lyricsQueryKeys.smartFetchLyrics(uniqueKey),
			})
		},
	})
}
