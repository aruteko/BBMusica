import { useLocalSearchParams, useRouter } from 'expo-router'
import { decode } from 'he'
import { useMemo, useEffect, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { useMMKVString } from 'react-native-mmkv'
import { Appbar, SegmentedButtons, Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { SearchUserHeader } from '@/features/playlist/remote/search-result/components/SearchUserHeader'
import { useSearchInteractions } from '@/features/playlist/remote/search-result/hooks/useSearchInteractions'
import {
	PlaylistTrackListSkeleton,
	TrackListItemSkeletonGroup,
} from '@/features/playlist/skeletons/PlaylistSkeleton'
import {
	type SearchVideoFilter,
	useSearchResults,
} from '@/hooks/queries/bilibili/search'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { analyticsService } from '@/lib/services/analyticsService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { formatMMSSToSeconds } from '@/utils/time'

const mapApiItemToTrack = (apiItem: BilibiliSearchVideo): BilibiliTrack => {
	return {
		id: apiItem.aid,
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title.replace(/<em[^>]*>|<\/em>/g, ''),
		artist: {
			id: apiItem.mid,
			name: apiItem.author,
			remoteId: apiItem.mid.toString(),
			source: 'bilibili',
			createdAt: new Date(apiItem.senddate),
			updatedAt: new Date(apiItem.senddate),
		},
		coverUrl: `https:${apiItem.pic}`,
		duration: apiItem.duration ? formatMMSSToSeconds(apiItem.duration) : 0,
		createdAt: new Date(apiItem.senddate),
		updatedAt: new Date(apiItem.senddate),
		titleHtml: apiItem.title,
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

export default function SearchResultsPage() {
	const isListReady = useScreenTransitionReady()
	const { colors } = useTheme()
	const { query } = useLocalSearchParams<{ query: string }>()
	const router = useRouter()

	const { selected, selectMode, toggle, enterSelectMode } = useTrackSelection()
	const selection = useMemo(
		() => ({
			active: selectMode,
			selected,
			toggle,
			enter: enterSelectMode,
		}),
		[selectMode, selected, toggle, enterSelectMode],
	)
	const [refreshing, setRefreshing] = useState(false)
	const openModal = useModalStore((state) => state.open)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()

	const [storedFilter, setStoredFilter] = useMMKVString('search_result_filter')
	const filter: SearchVideoFilter =
		storedFilter === 'music' || storedFilter === 'nonMusic' ? storedFilter : 'all'

	const {
		data: searchData,
		isPending: isPendingSearchData,
		isError: isErrorSearchData,
		hasNextPage,
		isFetchingNextPage,
		refetch,
		fetchNextPage,
	} = useSearchResults(query, filter)

	const loadedCount = searchData?.pages.reduce(
		(sum, page) => sum + page.result.length,
		0,
	)
	// 筛选后一页里剩下的结果很少时（例如「音乐以外」），自动多取几页，
	// 否则列表太短滚不动，就没法触发翻页
	useEffect(() => {
		if (
			filter !== 'all' &&
			hasNextPage &&
			!isFetchingNextPage &&
			(loadedCount ?? 0) < 12
		) {
			void fetchNextPage()
		}
	}, [filter, hasNextPage, isFetchingNextPage, loadedCount, fetchNextPage])

	useEffect(() => {
		if (query) {
			void analyticsService.logSearch('global')
		}
	}, [query])

	const { trackMenuItems, playTrack } = useSearchInteractions()

	const uniqueSearchData = useMemo(() => {
		if (!searchData?.pages) {
			return []
		}

		const allTracks = searchData.pages.flatMap((page) => page.result)
		const uniqueMap = new Map(
			allTracks.map((track) => [
				track.bvid,
				{
					...track,
					title: decode(track.title),
				},
			]),
		)
		const uniqueTracks = [...uniqueMap.values()]
		return uniqueTracks.map(mapApiItemToTrack)
	}, [searchData])

	if (!isListReady) {
		return <PlaylistTrackListSkeleton animate={isListReady} />
	}

	if (isErrorSearchData) {
		return <PlaylistError text='読み込みに失敗しました' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={
						selectMode
							? `${selected.size}\u2009曲を選択中`
							: `検索結果\u2009-\u2009${query}`
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							icon='playlist-plus'
							onPress={() => {
								const payloads = []
								for (const id of selected) {
									const track = uniqueSearchData.find((t) => t.id === id)
									if (track) {
										payloads.push({
											track: track as Track,
											artist: track.artist!,
										})
									}
								}
								openModal('BatchAddTracksToLocalPlaylist', {
									payloads,
								})
							}}
						/>
					</>
				) : (
					<Appbar.BackAction onPress={() => router.back()} />
				)}
			</Appbar.Header>

			<SegmentedButtons
				style={styles.filterRow}
				density='small'
				value={filter}
				onValueChange={(value) => setStoredFilter(value)}
				buttons={[
					{ value: 'all', label: 'すべて' },
					{ value: 'music', label: '音楽' },
					{ value: 'nonMusic', label: '音楽以外' },
				]}
			/>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={uniqueSearchData ?? []}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					ListHeaderComponent={<SearchUserHeader query={query} />}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true)
								await refetch()
								setRefreshing(false)
							}}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					ListEmptyComponent={
						isPendingSearchData ? (
							<View>
								<View style={styles.videoLoadingRow}>
									<Text
										variant='titleMedium'
										style={[
											styles.videoSectionTitle,
											{ color: colors.onSurface },
										]}
									>
										関連動画
									</Text>
									<ActivityIndicator
										size='small'
										style={{ marginLeft: 8 }}
									/>
								</View>
								<TrackListItemSkeletonGroup
									count={10}
									animate
								/>
							</View>
						) : (
							<Text
								style={[
									styles.emptyListText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								&ldquo;{query}&rdquo;&thinsp;に関する結果が見つかりません
							</Text>
						)
					}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContainer: {
		flex: 1,
	},
	filterRow: {
		marginHorizontal: 16,
		marginVertical: 8,
	},
	emptyListText: {
		paddingVertical: 32,
		textAlign: 'center',
	},
	videoLoadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		marginTop: 18,
		marginBottom: 4,
	},
	videoSectionTitle: {
		fontWeight: 'bold',
	},
})
