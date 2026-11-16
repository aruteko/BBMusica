import { LegendList } from '@legendapp/list/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Appbar, Divider, Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { CommentItem } from '@/features/comments/components/CommentItem'
import { useReplyComments } from '@/hooks/queries/bilibili/comments'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import { t } from '@/i18n'

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<BilibiliCommentItem, { bvid: string }>) => {
	if (!extraData) throw new Error(t('Extradata がありません'))
	const { bvid } = extraData
	return (
		<CommentItem
			item={item}
			bvid={bvid}
		/>
	)
}

export default function ReplyCommentsPage() {
	const { bvid, rpid } = useLocalSearchParams<{ bvid: string; rpid: string }>()
	const theme = useTheme()
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch,
		isRefetching,
	} = useReplyComments(bvid, Number(rpid))
	const router = useRouter()

	const replies = data?.pages.flatMap((page) => page.replies ?? []) ?? []
	const rootComment = data?.pages[0]?.root

	const extraData = useMemo(() => ({ bvid }), [bvid])

	const keyExtractor = useCallback(
		(item: BilibiliCommentItem) => item.rpid.toString(),
		[],
	)

	const divider = useCallback(() => <Divider />, [])

	if (!bvid || !rpid) {
		return (
			<View style={styles.center}>
				<Text>{t('パラメーターが正しくありません')}</Text>
			</View>
		)
	}

	const rpidNumber = Number(rpid)
	if (isNaN(rpidNumber)) {
		return (
			<View style={styles.center}>
				<Text>{t('無効なコメントIDです')}</Text>
			</View>
		)
	}

	return (
		<View
			style={[styles.container, { backgroundColor: theme.colors.background }]}
		>
			<Appbar.Header elevated>
				<Appbar.Content title={t('コメント')} />
				<Appbar.BackAction onPress={() => router.back()} />
			</Appbar.Header>
			{isLoading ? (
				<View style={styles.center}>
					<ActivityIndicator
						size='large'
						color={theme.colors.primary}
					/>
				</View>
			) : (
				<LegendList
					data={replies}
					extraData={extraData}
					keyExtractor={keyExtractor}
					recycleItems
					ListHeaderComponent={() =>
						rootComment ? (
							<View
								style={{
									borderBottomWidth: 1,
									borderBottomColor: theme.colors.outlineVariant,
								}}
							>
								<CommentItem
									item={rootComment}
									bvid={bvid}
								/>
							</View>
						) : null
					}
					renderItem={renderItem}
					onEndReached={() => {
						if (hasNextPage) void fetchNextPage()
					}}
					onEndReachedThreshold={0.5}
					ListFooterComponent={() =>
						isFetchingNextPage ? (
							<ActivityIndicator
								style={styles.footer}
								color={theme.colors.primary}
							/>
						) : null
					}
					ItemSeparatorComponent={divider}
					refreshing={isRefetching}
					onRefresh={refetch}
					contentContainerStyle={{ paddingBottom: 20 }}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	footer: {
		padding: 16,
		justifyContent: 'center',
		alignItems: 'center',
	},
})
