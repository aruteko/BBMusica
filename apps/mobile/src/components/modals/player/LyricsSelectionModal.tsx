import ImageThemeColors from '@bbplayer/image-theme-colors'
import { parseSpl, type LyricLine } from '@bbplayer/splash'
import { LegendList } from '@legendapp/list/react-native'
import { PermissionStatus } from 'expo'
import { Image, useImage } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TouchableRipple, useTheme } from 'react-native-paper'
import { captureRef, ViewShotRef } from 'react-native-view-shot'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import UniversalCheckbox from '@/components/common/UniversalCheckbox'
import { LyricsShareCard } from '@/features/player/components/sharing/LyricsShareCard'
import { useCurrentTrack } from '@/hooks/player/useCurrentTrack'
import { useGetMultiPageList } from '@/hooks/queries/bilibili/video'
import { useSmartFetchLyrics } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { ModalPropsMap } from '@/types/navigation'
import { resolveTrackCover } from '@/utils/imageUrl'
import log, { reportErrorToSentry } from '@/utils/log'
import toast from '@/utils/toast'

const LyricItem = memo(function LyricItem({
	item,
	index,
	isSelected,
	onToggle,
	primaryColor,
	onSurfaceColor,
	onSurfaceVariantColor,
}: {
	item: LyricLine
	index: number
	isSelected: boolean
	onToggle: (index: number) => void
	primaryColor: string
	onSurfaceColor: string
	onSurfaceVariantColor: string
}) {
	return (
		<TouchableRipple onPress={() => onToggle(index)}>
			<View style={styles.itemContainer}>
				<View style={{ flex: 1 }}>
					<Text
						variant='bodyLarge'
						style={{
							fontWeight: isSelected ? 'bold' : 'normal',
							color: isSelected ? primaryColor : onSurfaceColor,
						}}
					>
						{item.content}
					</Text>
					{item.translations?.[0] && (
						<Text
							variant='bodySmall'
							style={{
								color: isSelected ? primaryColor : onSurfaceVariantColor,
							}}
						>
							{item.translations[0]}
						</Text>
					)}
				</View>
				<UniversalCheckbox
					status={isSelected ? 'checked' : 'unchecked'}
					onPress={() => onToggle(index)}
				/>
			</View>
		</TouchableRipple>
	)
})

const sanitizeFileName = (name: string) => name.replace(/[/\\?%*:|"<>]/g, '-')

async function performShare(
	action: 'save' | 'share',
	previewUri: string | null,
	viewShotRef: { current: ViewShotRef | null },
	permissionStatus: unknown,
	requestPermission: () => Promise<MediaLibrary.PermissionResponse>,
	setIsSharing: (value: boolean) => void,
	isSharingRef: { current: boolean },
	close: (name: keyof ModalPropsMap) => void,
) {
	isSharingRef.current = true
	setIsSharing(true)

	try {
		let uri = previewUri
		const needsCapture = !uri && viewShotRef.current !== null
		if (needsCapture) {
			try {
				const fileName = `bbplayer-share-lyrics-${Date.now()}`
				uri = await captureRef(viewShotRef, {
					format: 'png',
					quality: 1,
					result: 'tmpfile',
					fileName,
				})
			} catch {
				toast.error('画像の生成に失敗しました')
				return
			}
		}

		if (!uri) {
			toast.error('画像の生成に失敗しました')
			return
		}

		if (action === 'save' && permissionStatus !== PermissionStatus.GRANTED) {
			const { status } = await requestPermission()
			if (status !== PermissionStatus.GRANTED) {
				toast.error('画像を保存できません', { description: 'アルバムへのアクセスを許可してください' })
				return
			}
		}

		if (action === 'save') {
			await MediaLibrary.Asset.create(uri)
			toast.success('アルバムに保存しました')
		} else {
			const sharingAvailable = await Sharing.isAvailableAsync()
			if (sharingAvailable) {
				await Sharing.shareAsync(uri)
			} else {
				toast.error('共有は利用できません')
				return
			}
		}
		close('LyricsSelection')
	} catch {
		toast.error('操作に失敗しました')
	} finally {
		setIsSharing(false)
		isSharingRef.current = false
	}
}

const LyricsSelectionModal = () => {
	const theme = useTheme()
	const currentTrack = useCurrentTrack()
	const close = useModalStore((state) => state.close)

	const {
		data: lyricsData,
		isPending,
		isError,
		error,
	} = useSmartFetchLyrics(true, currentTrack ?? undefined)

	const lyrics = useMemo(() => {
		if (!lyricsData?.lrc) return []
		try {
			const { lines: parsedLines } = parseSpl(lyricsData.lrc)
			const translationMap = new Map<number, string>()
			if (lyricsData.tlyric) {
				try {
					const { lines: transLines } = parseSpl(lyricsData.tlyric)
					transLines.forEach((l) => {
						translationMap.set(l.startTime, l.content)
					})
				} catch {
					// ignore
				}
			}

			if (translationMap.size > 0) {
				parsedLines.forEach((l) => {
					const trans = translationMap.get(l.startTime)
					if (trans) {
						if (!l.translations) l.translations = []
						l.translations.push(trans)
					}
				})
			}
			return parsedLines
		} catch {
			return []
		}
	}, [lyricsData])

	const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
		() => new Set(),
	)
	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
	const [isSharing, setIsSharing] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const [previewUri, setPreviewUri] = useState<string | null>(null)
	const [isGenerating, setIsGenerating] = useState(false)
	const [cardColor, setCardColor] = useState(theme.colors.elevation.level3)
	const currentTrackCover = currentTrack
		? resolveTrackCover(currentTrack.uniqueKey, currentTrack.coverUrl)
		: null
	const imageRef = useImage(
		{
			uri: currentTrackCover ?? '',
		},
		{
			onError: () => void 0,
		},
	)

	const isBilibili = currentTrack?.source === 'bilibili'
	const bvid = isBilibili ? currentTrack.bilibiliMetadata.bvid : undefined
	const cid = isBilibili ? currentTrack.bilibiliMetadata.cid : undefined

	const { data: pageList, isPending: isPageListQueryPending } =
		useGetMultiPageList(bvid)
	const isPageListPending = !!cid && isPageListQueryPending

	// 计算 shareUrl
	let shareUrl = `https://bbplayer.roitium.com/share/track?id=${encodeURIComponent(currentTrack?.uniqueKey ?? '')}&title=${encodeURIComponent(currentTrack?.title ?? '')}&cover=${encodeURIComponent(currentTrack?.coverUrl ?? '')}`
	if (cid && pageList) {
		const page = pageList.find((p) => p.cid === cid)
		if (page) {
			shareUrl += `&p=${page.page}`
		}
	}

	const viewShotRef = useRef<ViewShotRef>(null)

	useEffect(() => {
		if (imageRef) {
			ImageThemeColors.extractThemeColorAsync(imageRef)
				.then((palette) => {
					if (!palette) {
						setCardColor(theme.colors.elevation.level3)
						return
					}

					const bgColor = theme.dark
						? (palette.darkMuted?.hex ?? palette.muted?.hex)
						: (palette.lightMuted?.hex ?? palette.muted?.hex)

					if (bgColor) {
						setCardColor(bgColor)
					} else {
						setCardColor(theme.colors.elevation.level3)
					}
				})
				.catch((e) => {
					log.error('提取图片主题色失败', e)
					reportErrorToSentry(e, '提取图片主题色失败', 'LyricsSelectionModal')
					setCardColor(theme.colors.elevation.level3)
				})
		} else {
			setCardColor(theme.colors.elevation.level3)
		}
	}, [imageRef, theme.colors.elevation.level3, theme.dark])

	const toggleSelection = useCallback((index: number) => {
		setSelectedIndices((prev) => {
			const newSelected = new Set(prev)
			if (newSelected.has(index)) {
				newSelected.delete(index)
			} else {
				if (newSelected.size >= 5) {
					toast.error('歌詞は最大5行まで選べます')
					return prev
				}
				newSelected.add(index)
			}
			return newSelected
		})
		// 选择变化后清除旧预览
		setPreviewUri(null)
	}, [])

	const keyExtractor = useCallback(
		(item: LyricLine, index: number) => `${index}-${item.startTime}`,
		[],
	)

	const generatePreview = async () => {
		if (!viewShotRef.current) {
			toast.error('プレビューを生成できません')
			return
		}

		if (isPageListPending) {
			toast.info('共有リンクを取得中です。しばらくお待ちください')
			return
		}

		setIsGenerating(true)
		const fileName = `bbplayer-share-lyrics-${sanitizeFileName(currentTrack?.uniqueKey ?? '')}-${Date.now()}`
		try {
			const uri = await captureRef(viewShotRef, {
				format: 'png',
				quality: 1,
				result: 'tmpfile',
				fileName,
			})
			setPreviewUri(uri)
			setShowPreview(true)
			setIsGenerating(false)
		} catch {
			toast.error('プレビューの生成に失敗しました')
			setIsGenerating(false)
		}
	}

	const isSharingRef = useRef(false)

	const handleShare = (action: 'save' | 'share') => {
		if (selectedIndices.size === 0) {
			toast.error('先に歌詞を選んでください')
			return
		}

		if (isSharingRef.current) return

		void performShare(
			action,
			previewUri,
			viewShotRef,
			permissionResponse?.status,
			requestPermission,
			setIsSharing,
			isSharingRef,
			close,
		)
	}

	const renderItem = useCallback(
		({ item, index }: { item: LyricLine; index: number }) => (
			<LyricItem
				item={item}
				index={index}
				isSelected={selectedIndices.has(index)}
				onToggle={toggleSelection}
				primaryColor={theme.colors.primary}
				onSurfaceColor={theme.colors.onSurface}
				onSurfaceVariantColor={theme.colors.onSurfaceVariant}
			/>
		),
		[
			selectedIndices,
			theme.colors.onSurface,
			theme.colors.onSurfaceVariant,
			theme.colors.primary,
			toggleSelection,
		],
	)

	if (!currentTrack) {
		return (
			<>
				<Dialog.Title>共有する歌詞を選択</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						再生中の曲がありません
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>閉じる</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (currentTrack.source !== 'bilibili') {
		return (
			<>
				<Dialog.Title>共有する歌詞を選択</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						現在は、Bilibiliの曲のみ共有できます
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>閉じる</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (isPending) {
		return (
			<>
				<Dialog.Title>共有する歌詞を選択</Dialog.Title>
				<Dialog.Content style={styles.loadingContainer}>
					<ActivityIndicator size='large' />
					<Text
						variant='bodyMedium'
						style={styles.loadingText}
					>
						歌詞を読み込み中...
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>閉じる</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (isError) {
		return (
			<>
				<Dialog.Title>共有する歌詞を選択</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						歌詞の読み込みに失敗しました：{error?.message ?? '不明なエラー'}
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>閉じる</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (!lyrics || lyrics.length === 0) {
		return (
			<>
				<Dialog.Title>共有する歌詞を選択</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						歌詞がありません
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>閉じる</Button>
				</Dialog.Actions>
			</>
		)
	}

	// 预览模式：显示生成的预览图
	if (showPreview && previewUri) {
		return (
			<>
				<Dialog.Title>共有カードのプレビュー</Dialog.Title>
				<Dialog.Content style={styles.previewContentArea}>
					<Image
						source={{ uri: previewUri }}
						style={styles.previewImage}
						contentFit='contain'
					/>
				</Dialog.Content>
				<Dialog.Actions style={styles.actions}>
					<Button
						mode='text'
						onPress={() => setShowPreview(false)}
						icon='arrow-left'
						compact
					>
						選択に戻る
					</Button>
					<View style={{ flex: 1 }} />
					<Button
						mode='outlined'
						onPress={() => handleShare('save')}
						loading={isSharing}
						disabled={isSharing}
						icon='download'
					>
						保存
					</Button>
					<Button
						mode='contained'
						onPress={() => handleShare('share')}
						loading={isSharing}
						disabled={isSharing}
						icon='share-variant'
					>
						共有
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	return (
		<>
			<Dialog.Title>共有する歌詞を選択 ({selectedIndices.size}/5)</Dialog.Title>
			<Dialog.ScrollArea style={styles.scrollArea}>
				<LegendList
					data={lyrics}
					keyExtractor={keyExtractor}
					renderItem={renderItem}
					recycleItems
					showsVerticalScrollIndicator={false}
				/>
			</Dialog.ScrollArea>
			<Dialog.Actions style={styles.actions}>
				<Button
					mode='text'
					onPress={generatePreview}
					icon='eye'
					compact
					disabled={selectedIndices.size === 0 || isGenerating}
					loading={isGenerating}
				>
					プレビュー
				</Button>
				<View style={{ flex: 1 }} />
				<Button
					mode='outlined'
					onPress={() => handleShare('save')}
					loading={isSharing}
					disabled={isSharing || selectedIndices.size === 0}
					icon='download'
				>
					保存
				</Button>
				<Button
					mode='contained'
					onPress={() => handleShare('share')}
					loading={isSharing}
					disabled={isSharing || selectedIndices.size === 0}
					icon='share-variant'
				>
					共有
				</Button>
				<Button onPress={() => close('LyricsSelection')}>閉じる</Button>
			</Dialog.Actions>

			{/* Hidden Capture View - 始终渲染以确保 viewShotRef 可用 */}
			<View
				style={styles.hiddenCapture}
				pointerEvents='none'
			>
				<LyricsShareCard
					title={currentTrack.title}
					artistName={currentTrack.artist?.name ?? 'Unknown Artist'}
					imageRef={imageRef}
					shareUrl={shareUrl}
					selectedLyrics={lyrics.filter((_, i) => selectedIndices.has(i))}
					viewShotRef={viewShotRef}
					backgroundColor={cardColor}
				/>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	scrollArea: {
		height: 350,
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	actions: {
		flexWrap: 'wrap',
		gap: 4,
	},
	previewContentArea: {
		paddingHorizontal: 16,
		minHeight: 200,
	},
	previewImage: {
		width: '100%',
		aspectRatio: 0.8,
		borderRadius: 12,
	},
	loadingContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 40,
	},
	loadingText: {
		marginTop: 16,
		opacity: 0.7,
	},
	errorContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 40,
	},
	errorText: {
		opacity: 0.7,
		textAlign: 'center',
	},
	hiddenCapture: {
		position: 'absolute',
		top: 99999,
		left: 0,
		opacity: 0,
	},
})

export default LyricsSelectionModal
