import { LegendList } from '@legendapp/list/react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, Text, TextInput, useTheme } from 'react-native-paper'
import { MD3Colors } from 'react-native-paper/src/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import { useThemeSearch } from '@/hooks/queries/bilibili/theme'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { BilibiliGarbSearchItem } from '@/types/apis/bilibili'
import { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import { t } from '@/i18n'
import { CORNER_RADIUS } from '@/theme/dimensions'

const resultKey = (item: GarbSkinSearchResult) =>
	`${item.kind ?? 'unknown'}-${item.actId ?? item.itemId}-${item.name}`

const mapSearchItem = (item: BilibiliGarbSearchItem): GarbSkinSearchResult => {
	const { part_id: partId, properties: props } = item
	return {
		actId: Number(props.dlc_act_id) || null,
		coverUri:
			props.image_cover ??
			props.image_cover_long ??
			props.fan_share_image ??
			null,
		itemId: item.item_id || null,
		kind: partId === 0 ? 'collection' : partId === 6 ? 'suit' : null,
		lotteryId: Number(props.dlc_lottery_id) || null,
		name: item.name || t('名称未設定の装扮'),
		partId: partId ?? null,
	}
}

const confirmDownload = (item: GarbSkinSearchResult) => {
	const label = item.kind === 'collection' ? t('コレクション') : t('テーマ装扮')
	const openModal = useModalStore.getState().open
	alert(t('テーマ素材をダウンロード'), t('「{0}」の{1}素材をダウンロードしますか？', item.name, label), [
		{ text: t('キャンセル') },
		{
			text: t('ダウンロード'),
			onPress: () => {
				if (!item.kind) {
					alert(t('ダウンロードできません'), t('現在は、コレクションとテーマ装扮のみダウンロードできます。'), [
						{ text: t('OK') },
					])
					return
				}

				openModal('SkinDownloadProgress', { item }, { dismissible: false })
			},
		},
	])
}

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	GarbSkinSearchResult,
	{ colors: MD3Colors }
>) => {
	if (!extraData) throw new Error('extraData is undefined')
	const colors = extraData.colors
	return (
		<Pressable
			style={[styles.resultRow, { borderBottomColor: colors.outlineVariant }]}
			onPress={() => confirmDownload(item)}
		>
			{item.coverUri ? (
				<Image
					source={{ uri: item.coverUri }}
					style={styles.cover}
					contentFit='cover'
				/>
			) : (
				<View
					style={[styles.cover, { backgroundColor: colors.surfaceVariant }]}
				/>
			)}
			<View style={styles.resultText}>
				<Text numberOfLines={1}>{item.name}</Text>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					{item.kind === 'collection'
						? `${t('コレクション · act_id=')}${item.actId ?? '-'}`
						: item.kind === 'suit'
							? `${t('テーマ装扮 · item_id=')}${item.itemId}`
							: t('未対応の装扮の種類')}
				</Text>
			</View>
		</Pressable>
	)
}

export default function ThemeSkinSearchPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const [query, setQuery] = useState('')
	const [bufferedInput, setBufferedInput] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const {
		data: searchResult,
		isFetching,
		isFetchingNextPage,
		hasNextPage,
		refetch,
		fetchNextPage,
	} = useThemeSearch(query)
	const resultsToDisplay = useMemo(() => {
		return (
			searchResult?.pages
				.flatMap((page) => page.list ?? [])
				.map(mapSearchItem) ?? []
		)
	}, [searchResult])
	const extraData = useMemo(() => ({ colors }), [colors])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t('テーマを追加')} />
			</Appbar.Header>
			<View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
				<View style={styles.searchRow}>
					<TextInput
						mode='outlined'
						label={t('テーマ名')}
						value={bufferedInput}
						onChangeText={setBufferedInput}
						style={styles.searchInput}
						onSubmitEditing={() => setQuery(bufferedInput)}
						returnKeyType='search'
					/>
					<Button
						onPress={() => setQuery(bufferedInput)}
						loading={isFetching}
						disabled={isFetching}
					>{t('検索')}</Button>
				</View>

				<LegendList
					data={resultsToDisplay}
					keyExtractor={resultKey}
					recycleItems
					contentContainerStyle={styles.resultList}
					showsVerticalScrollIndicator={false}
					onEndReached={() => {
						if (hasNextPage) void fetchNextPage()
					}}
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
					extraData={extraData}
					renderItem={renderItem}
					ListEmptyComponent={
						isFetching ? (
							<View style={styles.emptyLoadingContainer}>
								<ActivityIndicator size='small' />
							</View>
						) : query ? (
							<Text
								variant='bodyMedium'
								style={[styles.empty, { color: colors.onSurfaceVariant }]}
							>{t('該当する装扮が見つかりません')}</Text>
						) : (
							<Text
								variant='bodySmall'
								style={[styles.empty, { color: colors.onSurfaceVariant }]}
							>{t('テーマ名を入力してBilibiliの装扮を検索')}</Text>
						)
					}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View style={styles.footerLoadingContainer}>
								<ActivityIndicator size='small' />
							</View>
						) : hasNextPage ? (
							<Text
								variant='titleMedium'
								style={styles.footerReachedEnd}
							>
								•
							</Text>
						) : null
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
	content: {
		flex: 1,
		paddingHorizontal: 20,
	},
	searchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	searchInput: {
		flex: 1,
	},
	resultList: {
		paddingTop: 12,
	},
	resultRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	cover: {
		width: 56,
		height: 56,
		borderRadius: CORNER_RADIUS,
	},
	resultText: {
		flex: 1,
		gap: 4,
	},
	empty: {
		marginTop: 32,
		textAlign: 'center',
	},
	emptyLoadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 32,
	},
	footerLoadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	footerReachedEnd: {
		textAlign: 'center',
		paddingTop: 10,
	},
})
