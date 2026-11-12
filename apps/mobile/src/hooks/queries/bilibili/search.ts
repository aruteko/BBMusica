import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import {
	MUSIC_PARTITION_TID,
	isMusicVideoTid,
} from '@/lib/api/bilibili/partitions'
import log from '@/utils/log'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

const logger = log.extend('Queries.SearchQueries')

/** 搜索结果的筛选：全部 / 只看音乐 / 排除音乐 */
export type SearchVideoFilter = 'all' | 'music' | 'nonMusic'

export const searchQueryKeys = {
	all: ['bilibili', 'search'] as const,
	results: (query: string, filter: SearchVideoFilter = 'all') =>
		[...searchQueryKeys.all, 'results', query, filter] as const,
	hotSearches: () => [...searchQueryKeys.all, 'hotSearches'] as const,
	suggestions: (query: string) =>
		[...searchQueryKeys.all, 'suggestions', query] as const,
	users: (query: string) => [...searchQueryKeys.all, 'users', query],
} as const

// 搜索结果查询
export const useSearchResults = (
	query: string,
	filter: SearchVideoFilter = 'all',
) => {
	const enabled = query.trim().length > 0
	return useInfiniteQuery({
		queryKey: searchQueryKeys.results(query, filter),
		queryFn: ({ pageParam, signal }) =>
			returnOrThrowAsync(
				bilibiliApi.searchVideos({
					keyword: query,
					page: pageParam,
					// 只看音乐时让服务端先限定在音乐区，翻页才不会被无关结果占满
					tids: filter === 'music' ? MUSIC_PARTITION_TID : undefined,
					signal,
				}),
			),
		// 服务端能限定「音乐区」，但乐评 / 教学也在音乐区里，另外「排除音乐」没有对应的
		// 服务端参数，所以这里再按分区过滤一次。numPages 保持服务端的值，翻页不受影响。
		select: (data) => {
			if (filter === 'all') return data
			return {
				...data,
				pages: data.pages.map((page) => ({
					...page,
					result: page.result.filter((item) =>
						filter === 'music'
							? isMusicVideoTid(item.typeid)
							: !isMusicVideoTid(item.typeid),
					),
				})),
			}
		},
		enabled,
		staleTime: 5 * 60 * 1000,
		initialPageParam: 1,
		getNextPageParam: (lastPage, allPages) => {
			if (lastPage.numPages === 0) {
				return undefined
			}
			if (lastPage.numPages === allPages.length) {
				return undefined
			}
			return allPages.length + 1
		},
	})
}

// 搜索用户查询
export const useUserSearchResults = (query: string) => {
	const enabled = query.trim().length > 0
	return useQuery({
		queryKey: searchQueryKeys.users(query),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(
				bilibiliApi.searchUsers({ keyword: query, page: 1, signal }),
			),
		enabled,
		staleTime: 5 * 60 * 1000,
	})
}

// 热门搜索查询
export const useHotSearches = () => {
	return useQuery({
		queryKey: searchQueryKeys.hotSearches(),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getHotSearches({ signal })),
		staleTime: 15 * 60 * 1000,
	})
}

// 搜索建议查询
export const useSearchSuggestions = (query: string) => {
	const enabled = query.trim().length > 0
	return useQuery({
		queryKey: searchQueryKeys.suggestions(query),
		queryFn: async ({ signal }) => {
			const result = await bilibiliApi.getSearchSuggestions({
				term: query,
				signal,
			})
			if (result.isErr()) {
				logger.warning('搜索建议查询失败，但无关紧要', { query })
				return []
			}
			return result.value
		},
		enabled,
		staleTime: 0,
	})
}
