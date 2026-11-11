import { useQuery } from '@tanstack/react-query'

import {
	fetchHomeRecommendations,
	fetchPopularMusicTracks,
} from '@/lib/services/recommendationService'
import log from '@/utils/log'

const logger = log.extend('Queries.Recommendations')

export const recommendationKeys = {
	all: ['recommendations'] as const,
	home: () => [...recommendationKeys.all, 'home'] as const,
	popular: () => [...recommendationKeys.all, 'popular'] as const,
}

const STALE_TIME = 15 * 60 * 1000

/**
 * 首页「为你推荐」。网络失败不弹 toast（首页不该因为推荐失败而打扰用户），
 * 失败时返回空列表，由下拉 / 点击「换一批」重试。
 */
export const useHomeRecommendations = () => {
	return useQuery({
		queryKey: recommendationKeys.home(),
		queryFn: async () => {
			try {
				return await fetchHomeRecommendations(20)
			} catch (error) {
				logger.warning('获取首页推荐失败', error)
				return { tracks: [], seeded: false }
			}
		},
		staleTime: STALE_TIME,
		retry: false,
		meta: { silent: true },
	})
}

/** 首页「热门音乐」（音乐分区排行榜） */
export const usePopularMusic = () => {
	return useQuery({
		queryKey: recommendationKeys.popular(),
		queryFn: async () => {
			try {
				return await fetchPopularMusicTracks(20)
			} catch (error) {
				logger.warning('获取热门音乐失败', error)
				return []
			}
		},
		staleTime: STALE_TIME,
		retry: false,
		meta: { silent: true },
	})
}
