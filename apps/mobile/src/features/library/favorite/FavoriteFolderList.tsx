import { LegendList } from '@legendapp/list/react-native'
import { useRouter } from 'expo-router'
import { memo, useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'

import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import TabDisable from '@/features/library/shared/TabDisabled'
import { FavoriteFolderListSkeleton } from '@/features/library/skeletons/LibraryTabSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetFavoritePlaylists } from '@/hooks/queries/bilibili/favorite'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import type { BilibiliPlaylist } from '@/types/apis/bilibili'

import FavoriteFolderListItem from './FavoriteFolderListItem'
import { t } from '@/i18n'
import { GRID_COLUMNS } from '@/components/common/GridCard'

const renderPlaylistItem = ({ item }: { item: BilibiliPlaylist }) => (
	<FavoriteFolderListItem item={item} />
)

const FavoriteFolderListComponent = memo(() => {
	const router = useRouter()
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [refreshing, setRefreshing] = useState(false)
	const [query, setQuery] = useState('')
	const enable = useAppStore((state) => state.hasBilibiliCookie())

	const { data: userInfo } = usePersonalInformation()
	const {
		data: playlists,
		isPending: playlistsIsPending,
		isRefetching: playlistsIsRefetching,
		refetch,
		isError: playlistsIsError,
	} = useGetFavoritePlaylists(userInfo?.mid)

	const keyExtractor = useCallback(
		(item: BilibiliPlaylist) => item.id.toString(),
		[],
	)

	const onRefresh = async () => {
		setRefreshing(true)
		await refetch()
		setRefreshing(false)
	}

	if (!enable) {
		return <TabDisable />
	}

	if (playlistsIsPending) {
		return <FavoriteFolderListSkeleton />
	}

	if (playlistsIsError) {
		return (
			<DataFetchingError
				text={t('読み込みに失敗しました')}
				onRetry={() => onRefresh()}
			/>
		)
	}

	const filteredPlaylists = playlists.filter(
		(item) => !item.title.startsWith('[mp]'),
	)

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text
					variant='titleMedium'
					style={styles.headerTitle}
				>{t('マイお気に入り')}</Text>
				<Text variant='bodyMedium'>
					{playlists.length ?? 0}{t('\u2009件のお気に入り')}</Text>
			</View>
			<SearchBar
				placeholder={t('お気に入りの内容を検索')}
				value={query}
				mode='bar'
				inputStyle={styles.searchInput}
				onChangeText={setQuery}
				style={styles.searchbar}
				onSubmitEditing={() => {
					setQuery('')
					router.navigate({
						pathname: '/playlist/remote/search-result/fav/[query]',
						params: { query },
					})
				}}
			/>
			<LegendList
				contentContainerStyle={{ paddingBottom: haveTrack ? 90 : 10 }}
				showsVerticalScrollIndicator={false}
				data={filteredPlaylists}
				renderItem={renderPlaylistItem}
				recycleItems
				numColumns={GRID_COLUMNS}
				refreshControl={
					<RefreshControl
						refreshing={refreshing || playlistsIsRefetching}
						onRefresh={onRefresh}
						colors={[colors.primary]}
						progressViewOffset={50}
					/>
				}
				keyExtractor={keyExtractor}
				ListEmptyComponent={<Text style={styles.emptyList}>{t('お気に入りがありません')}</Text>}
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
		height: 48, // 为了与 LocalPlaylistList 保持一致（LocalPlaylistList 上方存在一个 IconButton，所以会间隔更大一些）
		marginBottom: 4,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerTitle: {
		fontWeight: 'bold',
	},
	searchInput: {
		alignSelf: 'center',
	},
	searchbar: {
		borderRadius: 9999,
		textAlign: 'center',
		height: 45,
		marginBottom: 20,
		marginTop: 0,
	},
	emptyList: {
		textAlign: 'center',
	},
})

FavoriteFolderListComponent.displayName = 'FavoriteFolderListComponent'

export default FavoriteFolderListComponent
