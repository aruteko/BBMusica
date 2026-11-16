import { LegendList } from '@legendapp/list/react-native'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TouchableRipple } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import { useFetchLyrics } from '@/hooks/mutations/lyrics'
import { useManualSearchLyrics } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import type { LyricSearchResult } from '@/types/player/lyrics'
import { formatDurationToHHMMSS } from '@/utils/time'
import { t } from '@/i18n'

const SOURCE_MAP = {
	netease: 'NetEase Cloud Music',
	qqmusic: t('QQ音楽'),
	kuwo: 'Kuwo',
	kugou: 'KuGou',
	baidu: 'Baidu',
}

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	LyricSearchResult[0],
	{
		isFetchingLyrics: boolean
		handlePressItem: (item: LyricSearchResult[0]) => void
	}
>) => {
	if (!extraData) throw new Error(t('Extradata がありません'))
	return (
		<SearchItem
			item={item}
			onPress={extraData.handlePressItem}
			disabled={extraData.isFetchingLyrics}
		/>
	)
}

const SearchItem = memo(function SearchItem({
	item,
	onPress,
	disabled,
}: {
	item: LyricSearchResult[0]
	onPress: (item: LyricSearchResult[0]) => void
	disabled: boolean
}) {
	return (
		<TouchableRipple
			style={styles.searchItem}
			onPress={() => onPress(item)}
			disabled={disabled}
		>
			<View style={styles.searchItemContent}>
				<Text variant='bodyMedium'>{item.title}</Text>
				<Text variant='bodySmall'>{`${item.artist} - ${formatDurationToHHMMSS(
					Math.round(item.duration),
				)} - ${SOURCE_MAP[item.source]}`}</Text>
			</View>
		</TouchableRipple>
	)
})

const ManualSearchLyricsModal = ({
	uniqueKey,
	initialQuery,
}: {
	uniqueKey: string
	initialQuery: string
}) => {
	const [query, setQuery] = useState(initialQuery)
	const close = useModalStore((state) => state.close)

	const {
		results: searchResult,
		search: searchIt,
		isLoading: isSearching,
	} = useManualSearchLyrics(uniqueKey)
	const { mutate: fetchLyrics, isPending: isFetchingLyrics } = useFetchLyrics()
	const handlePressItem = useCallback(
		(item: LyricSearchResult[0]) => {
			fetchLyrics(
				{
					uniqueKey,
					item,
				},
				{ onSuccess: () => close('ManualSearchLyrics') },
			)
		},
		[close, fetchLyrics, uniqueKey],
	)
	const extraData = useMemo(
		() => ({ isFetchingLyrics, handlePressItem }),
		[handlePressItem, isFetchingLyrics],
	)

	const keyExtractor = useCallback(
		(item: LyricSearchResult[0]) => item.remoteId.toString(),
		[],
	)

	const renderContent = () => {
		if (!searchResult) {
			return (
				<View style={styles.centerContainer}>
					<Text style={styles.centerText}>{t('検索キーワードを変更して、Enterで検索してください')}</Text>
				</View>
			)
		}

		// When loading initially (no results yet)
		if (isSearching && searchResult.length === 0) {
			return (
				<View style={styles.centerContainer}>
					<ActivityIndicator size={'large'} />
				</View>
			)
		}

		if (searchResult.length > 0) {
			return (
				<LegendList
					data={searchResult}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					extraData={extraData}
					recycleItems
				/>
			)
		}

		// Search finished but nothing found
		if (!isSearching && searchResult.length === 0) {
			return (
				<View style={styles.centerContainer}>
					<Text style={styles.centerText}>{t('一致する歌詞が見つかりません')}</Text>
				</View>
			)
		}

		// Fallback for edge cases
		return null
	}

	return (
		<>
			<Dialog.Title style={styles.dialogTitle}>
				<View style={styles.titleContainer}>
					<Text variant='headlineSmall'>{t('歌詞を手動で検索')}</Text>
					{isSearching && (
						<ActivityIndicator
							size='small'
							style={styles.loadingIndicator}
						/>
					)}
				</View>
			</Dialog.Title>
			<Dialog.Content>
				<SearchBar
					value={query}
					onChangeText={setQuery}
					placeholder={t('曲名を入力')}
					onSubmitEditing={() => searchIt(query)}
				/>
			</Dialog.Content>
			<Dialog.ScrollArea style={styles.scrollArea}>
				{renderContent()}
			</Dialog.ScrollArea>
			<Dialog.Actions>
				<Button
					onPress={() => close('ManualSearchLyrics')}
					disabled={isFetchingLyrics}
				>{t('キャンセル')}</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	searchItem: {
		flexDirection: 'column',
		paddingVertical: 8,
	},
	searchItemContent: {
		flexDirection: 'column',
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	centerText: {
		textAlign: 'center',
	},
	scrollArea: {
		height: 300,
	},
	loadingOverlay: {
		paddingVertical: 10,
		alignItems: 'center',
	},
	dialogTitle: {
		alignItems: 'center',
	},
	titleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	loadingIndicator: {
		marginLeft: 8,
	},
})

export default ManualSearchLyricsModal
