import { LegendList } from '@legendapp/list/react-native'
import { memo, useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import TabDisable from '@/features/library/shared/TabDisabled'
import { MultiPageVideosListSkeleton } from '@/features/library/skeletons/LibraryTabSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	useGetFavoritePlaylists,
	useInfiniteFavoriteList,
} from '@/hooks/queries/bilibili/favorite'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'

import MultiPageVideosItem from './MultiPageVideosItem'

const renderPlaylistItem = ({
	item,
}: {
	item: BilibiliFavoriteListContent
}) => <MultiPageVideosItem item={item} />

const MultiPageVideosListComponent = memo(() => {
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [refreshing, setRefreshing] = useState(false)
	const enable = useAppStore((state) => state.hasBilibiliCookie())

	const { data: userInfo } = usePersonalInformation()
	const {
		data: playlists,
		isPending: playlistsIsPending,
		isError: playlistsIsError,
		isRefetching: playlistsIsRefetching,
		refetch: refetchPlaylists,
	} = useGetFavoritePlaylists(userInfo?.mid)
	const {
		data: favoriteData,
		isError: isFavoriteDataError,
		isPending: isFavoriteDataPending,
		isRefetching: isFavoriteDataRefetching,
		fetchNextPage,
		refetch: refetchFavoriteData,
		hasNextPage,
	} = useInfiniteFavoriteList(
		playlists?.find((item) => item.title.startsWith('[mp]'))?.id,
	)

	const keyExtractor = useCallback(
		(item: BilibiliFavoriteListContent) => item.bvid,
		[],
	)

	const onRefresh = async () => {
		setRefreshing(true)
		await Promise.all([refetchPlaylists(), refetchFavoriteData()])
		setRefreshing(false)
	}

	if (!enable) {
		return <TabDisable />
	}

	if (playlistsIsPending || isFavoriteDataPending) {
		return <MultiPageVideosListSkeleton />
	}

	if (playlistsIsError || isFavoriteDataError) {
		return (
			<DataFetchingError
				text='読み込みに失敗しました'
				onRetry={() => onRefresh()}
			/>
		)
	}

	if (!playlists?.find((item) => item.title.startsWith('[mp]'))) {
		return (
			<View style={styles.noMpContainer}>
				<Text
					variant='titleMedium'
					style={styles.noMpText}
				>
					分割P動画のお気に入りが見つかりません。先にお気に入りを作成し、名前を&thinsp;[mp]&thinsp;で始めてください
				</Text>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text
					variant='titleMedium'
					style={styles.headerTitle}
				>
					分割P動画
				</Text>
				<Text variant='bodyMedium'>
					{favoriteData.pages[0]?.info?.media_count ?? 0}
					&thinsp;件の分割P動画
				</Text>
			</View>
			<LegendList
				contentContainerStyle={{ paddingBottom: haveTrack ? 90 : 10 }}
				showsVerticalScrollIndicator={false}
				data={favoriteData.pages.flatMap((page) => page.medias ?? []) ?? []}
				renderItem={renderPlaylistItem}
				recycleItems
				keyExtractor={keyExtractor}
				refreshControl={
					<RefreshControl
						refreshing={
							refreshing || playlistsIsRefetching || isFavoriteDataRefetching
						}
						onRefresh={onRefresh}
						colors={[colors.primary]}
						progressViewOffset={50}
					/>
				}
				ListEmptyComponent={
					<Text style={styles.emptyList}>分割P動画がありません</Text>
				}
				onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		marginHorizontal: 16,
	},
	headerContainer: {
		height: 48,
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerTitle: {
		fontWeight: 'bold',
	},
	noMpContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	noMpText: {
		textAlign: 'center',
	},
	emptyList: {
		textAlign: 'center',
	},
})

MultiPageVideosListComponent.displayName = 'MultiPageVideosListComponent'

export default MultiPageVideosListComponent
