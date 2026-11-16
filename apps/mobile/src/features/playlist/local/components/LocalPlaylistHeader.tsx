import { Orpheus } from '@bbplayer/orpheus'
import * as Clipboard from 'expo-clipboard'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import {
	Divider,
	Text,
	TouchableRipple,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import PlaylistCover from '@/components/common/PlaylistCover'
import ExpandableText from '@/components/common/ExpandableText'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { resolveTrackCover } from '@/utils/imageUrl'
import { getInternalPlayUri } from '@/utils/player'
import { formatDurationToText, formatRelativeTime } from '@/utils/time'
import toast from '@/utils/toast'
import { t as tr } from '@/i18n'

interface PlaylistHeaderProps {
	playlist: Playlist & { validTrackCount: number }
	totalDuration?: number
	onClickPlayAll: () => void
	onClickSync: () => void
	onClickCopyToLocalPlaylist: () => void
	/** 当作者为 bilibili 时触发。可选，未提供时仅视觉提示不响应 */
	onPressAuthor?: (author: NonNullable<Playlist['author']>) => void
	coverRef?: ImageRef | null
	primaryButtonColor?: string
	primaryButtonTextColor?: string
	secondaryButtonContainerColor?: string
	secondaryButtonIconColor?: string
}

interface SubtitlePieces {
	isLocal: boolean
	authorName?: string
	authorClickable: boolean
	countText: string
	syncLine?: string // 带“最終同期：xxx”的整行
}

// 三元运算符过于难懂，还是用函数好一些
function buildSubtitlePieces(
	playlist: Playlist & { validTrackCount: number },
	totalDuration: number | undefined,
): SubtitlePieces {
	const isLocal = playlist.type === 'local' || playlist.type === 'dynamic'

	const countRaw =
		playlist.validTrackCount !== playlist.itemCount
			? `${playlist.itemCount}${tr('\u2009曲\u2009•\u2009')}${playlist.itemCount - playlist.validTrackCount}${tr('\u2009曲が無効')}`
			: `${playlist.itemCount}${tr('\u2009曲')}`

	let countText = countRaw
	if (totalDuration !== undefined) {
		countText += `${tr('\u2009•\u2009合計\u2009')}${formatDurationToText(totalDuration)}`
	}

	const authorName = !isLocal
		? (playlist.author?.name ?? tr('不明なアーティスト'))
		: undefined
	const authorClickable =
		!!authorName && !isLocal && playlist.author?.source === 'bilibili'

	const syncLine = !isLocal
		? `${tr('最終同期：')}${
				playlist.lastSyncedAt
					? formatRelativeTime(playlist.lastSyncedAt)
					: tr('不明')
			}`
		: undefined

	return { isLocal, authorName, authorClickable, countText, syncLine }
}

/**
 * プレイリスト头部组件。
 */
export const PlaylistHeader = memo(function PlaylistHeader({
	playlist,
	totalDuration,
	onClickPlayAll,
	onClickSync,
	onClickCopyToLocalPlaylist,
	onPressAuthor,
	coverRef,
	primaryButtonColor,
	primaryButtonTextColor,
	secondaryButtonContainerColor,
	secondaryButtonIconColor,
}: PlaylistHeaderProps) {
	const [showFullTitle, setShowFullTitle] = useState(false)
	const router = useRouter()
	const { width, height } = useWindowDimensions()
	const coverSize = width < 360 || height < 700 ? 88 : 120

	const { isLocal, authorName, authorClickable, countText, syncLine } = useMemo(
		() => buildSubtitlePieces(playlist, totalDuration),
		[playlist, totalDuration],
	)
	const onClickDownloadAll = useCallback(async () => {
		const tracksResult = await playlistService.getPlaylistTracks(playlist.id)
		if (tracksResult.isErr()) {
			toastAndLogError(
				tr('プレイリストの内容を取得できませんでした'),
				tracksResult.error,
				'UI.Playlist.Local.Header',
			)
			return
		}
		void Orpheus.multiDownload(
			tracksResult.value
				.filter((item) =>
					item.source === 'bilibili'
						? item.bilibiliMetadata.videoIsValid
						: true,
				)
				.map((t) => {
					const url = getInternalPlayUri(t)
					if (!url) return
					return {
						id: t.uniqueKey,
						title: t.title,
						url: url,
						artist: t.artist?.name,
						artwork: resolveTrackCover(t.uniqueKey, t.coverUrl) ?? undefined,
						duration: t.duration,
					}
				})
				.filter((t) => !!t),
		)
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.navigate('/download')
		})
	}, [playlist.id, router])

	if (!playlist.title) return null

	return (
		<View style={styles.container}>
			{/* 顶部信息 */}
			<View style={styles.headerContainer}>
				<PlaylistCover
					id={playlist.id}
					cover={coverRef ?? playlist.coverUrl}
					previewCovers={playlist.previewCovers}
					title={playlist.title}
					size={coverSize}
				/>

				<View style={styles.headerTextContainer}>
					<TouchableRipple
						onPress={() => setShowFullTitle(!showFullTitle)}
						onLongPress={async () => {
							const result = await Clipboard.setStringAsync(playlist.title)
							if (!result) {
								toast.error(tr('コピーに失敗しました'))
							} else {
								toast.success(tr('タイトルをクリップボードにコピーしました'))
							}
						}}
					>
						<Text
							variant='titleLarge'
							style={styles.title}
							numberOfLines={showFullTitle ? undefined : 2}
						>
							{playlist.title}
						</Text>
					</TouchableRipple>

					<Text
						variant='bodySmall'
						style={styles.subtitle}
						numberOfLines={3}
					>
						{isLocal ? (
							<>
								{countText}
							</>
						) : (
							<>
								{/* 作者名 */}
								{tr('作成者：')}
								<Text
									variant='bodySmall'
									onPress={
										authorClickable && playlist.author
											? () => onPressAuthor?.(playlist.author!)
											: undefined
									}
									style={{
										textDecorationLine: authorClickable ? 'underline' : 'none',
									}}
								>
									{authorName}
								</Text>
								{'\n'}
								{countText}
								{syncLine ? '\n' : ''}
								{syncLine}
							</>
						)}
					</Text>

				</View>
			</View>

			{/* 操作按钮 */}
			<View
				style={[
					styles.actionsContainer,
					{ marginBottom: playlist.description ? 0 : 16 },
				]}
			>
				<View style={styles.actionButtons}>
					<Button
						mode='contained'
						icon='play'
						onPress={() => onClickPlayAll()}
						testID='playlist-play-all'
						buttonColor={primaryButtonColor}
						textColor={primaryButtonTextColor}
					>{tr('すべて再生')}</Button>

					{playlist.type !== 'local' && playlist.type !== 'dynamic' && (
						<IconButton
							mode='contained'
							icon='sync'
							size={20}
							onPress={onClickSync}
							testID='playlist-sync'
							containerColor={secondaryButtonContainerColor}
							iconColor={secondaryButtonIconColor}
						/>
					)}

					<IconButton
						mode='contained'
						icon='content-copy'
						size={20}
						onPress={onClickCopyToLocalPlaylist}
						testID='playlist-copy'
						containerColor={secondaryButtonContainerColor}
						iconColor={secondaryButtonIconColor}
					/>
					<IconButton
						mode='contained'
						icon='download'
						size={20}
						onPress={() =>
							alert(
								tr('すべてダウンロードしますか？'),
								tr('このプレイリストの曲をすべてダウンロードしますか？'),
								[
									{
										text: tr('キャンセル'),
									},
									{
										text: tr('OK'),
										onPress: onClickDownloadAll,
									},
								],
								{ cancelable: true },
							)
						}
						testID='playlist-download'
						containerColor={secondaryButtonContainerColor}
						iconColor={secondaryButtonIconColor}
					/>
				</View>
			</View>

			{/* 描述 */}
			{!!playlist.description && (
				<View style={styles.description}>
					<ExpandableText
						text={playlist.description}
						lines={3}
						expandLabel={tr('概要を表示')}
						collapseLabel={tr('概要を閉じる')}
					/>
				</View>
			)}

			<Divider />
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		flexDirection: 'column',
	},
	headerContainer: {
		flexDirection: 'row',
		margin: 16,
		alignItems: 'center',
	},
	headerTextContainer: {
		marginLeft: 16,
		flex: 1,
		justifyContent: 'center',
		marginVertical: 8,
	},
	title: {
		fontWeight: 'bold',
		marginBottom: 8,
	},
	subtitle: {
		fontWeight: '100',
		lineHeight: 18,
	},
	actionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		marginHorizontal: 16,
	},
	actionButtons: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		alignItems: 'center',
	},
	description: {
		margin: 16,
	},
})
