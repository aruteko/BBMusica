import { Orpheus, type DownloadTask } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
import { LegendList } from '@legendapp/list/react-native'
import type { TrueSheet as TrueSheetType } from '@lodev09/react-native-true-sheet'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
	StyleSheet,
	ToastAndroid,
	View,
	Platform,
	Alert,
	PermissionsAndroid,
} from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Appbar, Divider, Surface, Text, useTheme } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import UniversalCheckbox from '@/components/common/UniversalCheckbox'
import { alert } from '@/components/modals/AlertModal'
import ExportDownloadsProgressModal from '@/components/modals/settings/ExportDownloadsProgressModal'
import { useTrackSelection } from '@/features/playlist/local/hooks/useTrackSelection'
import { useRemoveDownloadsMutation } from '@/hooks/mutations/orpheus'
import {
	useCompletedDownloads,
	orpheusQueryKeys,
} from '@/hooks/queries/orpheus'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import { queryClient } from '@/lib/config/queryClient'
import { enqueueTracks } from '@/lib/player/playbackSession'
import {
	LIST_ITEM_COVER_SIZE,
	LIST_ITEM_BORDER_RADIUS,
} from '@/theme/dimensions'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'
import toast from '@/utils/toast'
import { t as tr } from '@/i18n'

const EXPORT_ICON = Icon.select({
	ios: 'square.and.arrow.up',
	android: import('@expo/material-symbols/ios_share.xml'),
})

const DELETE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const PLAY_NEXT_ICON = Icon.select({
	ios: 'arrow.right.to.line.circle',
	android: import('@expo/material-symbols/skip_next.xml'),
})

const PUBLIC_MUSIC_EXPORT_URI = 'orpheus://public-music'

interface DownloadedItemExtraData {
	selectMode: boolean
	selected: Set<string>
	toggleSelected: (id: string) => void
	enterSelectMode: (id: string) => void
	onItemPress: (item: DownloadTask) => void
	onSingleExport: (id: string) => void
	onDelete: (id: string) => void
	onPlayNext: (item: DownloadTask) => void
}

function renderDownloadedItem({
	item,
	index,
	extraData,
}: {
	item: DownloadTask
	index: number
	extraData?: DownloadedItemExtraData
}) {
	return (
		<DownloadedItem
			item={item}
			index={index}
			selectMode={extraData?.selectMode ?? false}
			isSelected={extraData?.selected.has(item.id) ?? false}
			toggleSelected={extraData?.toggleSelected ?? (() => {})}
			enterSelectMode={extraData?.enterSelectMode ?? (() => {})}
			onItemPress={extraData?.onItemPress ?? (() => {})}
			onSingleExport={extraData?.onSingleExport ?? (() => {})}
			onDelete={extraData?.onDelete ?? (() => {})}
			onPlayNext={extraData?.onPlayNext ?? (() => {})}
		/>
	)
}

function DownloadedItem({
	item,
	index,
	selectMode,
	isSelected,
	toggleSelected,
	enterSelectMode,
	onItemPress,
	onSingleExport,
	onDelete,
	onPlayNext,
}: {
	item: DownloadTask
	index: number
	selectMode: boolean
	isSelected: boolean
	toggleSelected: (id: string) => void
	enterSelectMode: (id: string) => void
	onItemPress: (item: DownloadTask) => void
	onSingleExport: (id: string) => void
	onDelete: (id: string) => void
	onPlayNext: (item: DownloadTask) => void
}) {
	const theme = useTheme()
	const track = item.track

	const menuActions = useMenuActions([
		{
			title: tr('エクスポート'),
			image: EXPORT_ICON,
			onPress: () => onSingleExport(item.id),
		},
		{
			title: tr('削除'),
			image: DELETE_ICON,
			onPress: () => onDelete(item.id),
		},
		{
			title: tr('次に再生'),
			image: PLAY_NEXT_ICON,
			onPress: () => onPlayNext(item),
			attributes: { disabled: !item.track },
		},
	])

	return (
		<Touchable
			androidRipple={{}}
			style={[
				styles.rectButton,
				{
					backgroundColor: isSelected
						? theme.dark
							? 'rgba(255, 255, 255, 0.12)'
							: 'rgba(0, 0, 0, 0.12)'
						: 'transparent',
				},
			]}
			onPress={() => {
				if (selectMode) {
					toggleSelected(item.id)
					return
				}
				onItemPress(item)
			}}
			onLongPress={() => {
				if (!selectMode) {
					enterSelectMode(item.id)
				}
			}}
		>
			<Surface
				style={styles.surface}
				elevation={0}
			>
				<View style={styles.itemContainer}>
					<View style={styles.indexContainer}>
						{selectMode && (
							<View style={styles.checkboxContainer}>
								<UniversalCheckbox
									status={isSelected ? 'checked' : 'unchecked'}
								/>
							</View>
						)}
						<View style={{ opacity: selectMode ? 0 : 1 }}>
							<Text
								variant='bodyMedium'
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{index + 1}
							</Text>
						</View>
					</View>

					<CoverWithPlaceHolder
						id={item.id}
						cover={track?.artwork}
						title={track?.title ?? tr('不明な曲')}
						size={LIST_ITEM_COVER_SIZE}
					/>

					<View style={styles.titleContainer}>
						<Text
							variant='bodySmall'
							numberOfLines={1}
						>
							{track?.title ?? tr('不明な曲')}
						</Text>
						<View style={styles.detailsContainer}>
							{track?.artist && (
								<>
									<Text
										variant='bodySmall'
										numberOfLines={1}
									>
										{track.artist}
									</Text>
									<Text
										style={styles.dotSeparator}
										variant='bodySmall'
									>
										•
									</Text>
								</>
							)}
							<Text variant='bodySmall'>
								{track?.duration ? formatDurationToHHMMSS(track.duration) : ''}
							</Text>
						</View>
					</View>

					{!selectMode && (
						<MenuView {...menuActions}>
							<IconButton
								icon='dots-vertical'
								size={20}
								iconColor={theme.colors.onSurfaceVariant}
							/>
						</MenuView>
					)}
				</View>
			</Surface>
		</Touchable>
	)
}

export default function DownloadedPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const exportSheetRef = useRef<TrueSheetType>(null)
	const [exportConfig, setExportConfig] = useState<{
		ids: string[]
		destinationUri: string
	} | null>(null)

	const { data: completedDownloads, isPending } = useCompletedDownloads()
	const completedTasks = useMemo(
		() => completedDownloads ?? [],
		[completedDownloads],
	)

	const [searchQuery, setSearchQuery] = useState('')
	const [isSearching, setIsSearching] = useState(false)

	const filteredTasks = (() => {
		if (!searchQuery.trim()) return completedTasks
		const query = searchQuery.toLowerCase()
		return completedTasks.filter((t) => {
			const track = t.track
			return (
				track?.title?.toLowerCase().includes(query) ||
				track?.artist?.toLowerCase().includes(query)
			)
		})
	})()

	const {
		selected,
		selectMode,
		toggle,
		enterSelectMode,
		exitSelectMode,
		setSelected,
	} = useTrackSelection<string>()

	const removeDownloadsMutation = useRemoveDownloadsMutation()

	const handlePlayItem = useCallback((item: DownloadTask) => {
		if (!item.track) {
			toast.error(tr('このダウンロードには曲の情報がないため、再生できません'))
			return
		}

		void enqueueTracks({
			tracks: [item.track],
			startFromKey: item.track.id,
		}).catch((error: unknown) =>
			toastAndLogError(tr('再生に失敗しました'), error, 'Downloaded.Page'),
		)
	}, [])

	const resolveExportDestination = useCallback(async () => {
		const hasDirectoryPicker = await Orpheus.isDirectoryPickerAvailable()
		if (!hasDirectoryPicker) {
			// For API < 29, we need WRITE_EXTERNAL_STORAGE permission for public music export
			if (Platform.OS === 'android' && Platform.Version < 29) {
				const permissionResult = await PermissionsAndroid.request(
					PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
					{
						title: tr('ストレージの権限'),
						message: tr('エクスポートにはストレージの権限が必要です'),
						buttonPositive: 'OK',
						buttonNegative: tr('キャンセル'),
					},
				)
				if (permissionResult !== PermissionsAndroid.RESULTS.GRANTED) {
					toast.error(tr('エクスポートにはストレージの権限が必要です'))
					return null
				}
			}
			toast.info(tr('Music/BBMusica に保存します'))
			return PUBLIC_MUSIC_EXPORT_URI
		}

		ToastAndroid.showWithGravity(
			tr('エクスポート先のフォルダーを選んでください'),
			ToastAndroid.SHORT,
			ToastAndroid.BOTTOM,
		)
		return await Orpheus.selectDirectory()
	}, [])

	const handleSingleExport = useCallback(
		async (id: string) => {
			if (Platform.OS !== 'android') {
				Alert.alert(tr('お知らせ'), tr('音声のエクスポートは、現在 Android のみ対応しています'))
				return
			}

			const directoryUri = await resolveExportDestination()
			if (directoryUri) {
				setExportConfig({ ids: [id], destinationUri: directoryUri })
				void exportSheetRef.current?.present()
			}
		},
		[resolveExportDestination],
	)

	const handleDelete = useCallback(
		(id: string) => {
			const task = completedTasks.find((t) => t.id === id)
			const title = task?.track?.title ?? id
			alert(
				tr('ダウンロードを削除'),
				tr('「{0}」のダウンロード記録とキャッシュファイルを削除しますか？', title),
				[
					{ text: tr('キャンセル') },
					{
						text: tr('削除'),
						onPress: async () => {
							try {
								await Orpheus.removeDownload(id)
								await queryClient.invalidateQueries({
									queryKey: orpheusQueryKeys.completedDownloads(),
								})
							} catch (e) {
								toastAndLogError(tr('ダウンロードの削除に失敗しました'), e, 'Downloaded.Page')
							}
						},
					},
				],
				{ cancelable: true },
			)
		},
		[completedTasks],
	)

	const handlePlayNext = useCallback(async (task: DownloadTask) => {
		if (!task.track) return
		try {
			await enqueueTracks({ tracks: [task.track], playNext: true })
			toast.success(tr('次に再生に追加しました'))
		} catch (error) {
			toastAndLogError(tr('次に再生への追加に失敗しました'), error, 'Download')
		}
	}, [])

	const handleExport = async () => {
		const idsToExport =
			selected.size > 0 ? Array.from(selected) : completedTasks.map((t) => t.id)

		if (idsToExport.length === 0) {
			if (Platform.OS === 'android') {
				ToastAndroid.showWithGravity(
					tr('エクスポートできる曲がありません'),
					ToastAndroid.SHORT,
					ToastAndroid.BOTTOM,
				)
			} else {
				Alert.alert(tr('お知らせ'), tr('エクスポートできる曲がありません'))
			}
			return
		}

		if (Platform.OS !== 'android') {
			Alert.alert(tr('お知らせ'), tr('音声のエクスポートは、現在 Android のみ対応しています'))
			return
		}

		const directoryUri = await resolveExportDestination()
		if (directoryUri) {
			setExportConfig({ ids: idsToExport, destinationUri: directoryUri })
			void exportSheetRef.current?.present()
			if (selectMode) {
				exitSelectMode()
			}
		}
	}

	const handleBatchDelete = useCallback(() => {
		const idsToDelete = Array.from(selected)
		if (idsToDelete.length === 0) return
		alert(
			tr('まとめて削除'),
			tr('選んだ {0} 曲のダウンロード記録とキャッシュファイルを削除しますか？', idsToDelete.length),
			[
				{ text: tr('キャンセル') },
				{
					text: tr('削除'),
					onPress: () => {
						removeDownloadsMutation.mutate(idsToDelete, {
							onSuccess: () => exitSelectMode(),
							onError: (e) =>
								toastAndLogError(tr('まとめて削除に失敗しました'), e, 'Downloaded.Page'),
						})
					},
				},
			],
			{ cancelable: true },
		)
	}, [selected, exitSelectMode, removeDownloadsMutation])

	const invertSelection = useCallback(() => {
		const allIds = filteredTasks.map((t) => t.id)
		const inverted = new Set(allIds.filter((id) => !selected.has(id)))
		setSelected(inverted)
		void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
	}, [filteredTasks, selected, setSelected])

	const extraData = useMemo<DownloadedItemExtraData>(
		() => ({
			selectMode,
			selected,
			toggleSelected: (id: string) => {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Clock_Tick)
				toggle(id)
			},
			enterSelectMode: (id: string) => {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
				enterSelectMode(id)
			},
			onItemPress: handlePlayItem,
			onSingleExport: handleSingleExport,
			onDelete: handleDelete,
			onPlayNext: handlePlayNext,
		}),
		[
			selectMode,
			selected,
			toggle,
			enterSelectMode,
			handlePlayItem,
			handleSingleExport,
			handleDelete,
			handlePlayNext,
		],
	)

	if (isPending) {
		return (
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				<ActivityIndicator
					size='large'
					color={colors.primary}
					style={{ flex: 1 }}
				/>
			</View>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction
					onPress={() => (selectMode ? exitSelectMode() : router.back())}
				/>
				<Appbar.Content
					title={selectMode ? `${selected.size}${tr(' 件を選択中')}` : tr('ダウンロード管理')}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							icon='select-all'
							onPress={() =>
								setSelected(new Set(filteredTasks.map((t) => t.id)))
							}
						/>
						<Appbar.Action
							icon='select-compare'
							onPress={invertSelection}
						/>
						<Appbar.Action
							icon='trash-can-outline'
							onPress={handleBatchDelete}
							disabled={selected.size === 0}
						/>
						<Appbar.Action
							icon='export-variant'
							onPress={handleExport}
							disabled={selected.size === 0}
						/>
					</>
				) : (
					<>
						<Appbar.Action
							icon='magnify'
							onPress={() => setIsSearching(!isSearching)}
						/>
						<Appbar.Action
							icon='progress-download'
							onPress={() => router.navigate('/download')}
						/>
						<Appbar.Action
							icon='export-variant'
							onPress={handleExport}
							disabled={completedTasks.length === 0}
						/>
					</>
				)}
			</Appbar.Header>

			{isSearching && !selectMode && (
				<SearchBar
					placeholder={tr('ダウンロード済みの曲を検索')}
					onChangeText={setSearchQuery}
					value={searchQuery}
					style={styles.searchbar}
					onIconPress={() => setIsSearching(false)}
				/>
			)}

			<View style={styles.listContainer}>
				<LegendList
					data={filteredTasks}
					renderItem={renderDownloadedItem}
					extraData={extraData}
					keyExtractor={(item) => item.id}
					recycleItems
					ItemSeparatorComponent={() => <Divider />}
					contentContainerStyle={{
						paddingBottom: insets.bottom + 70,
					}}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text variant='bodyLarge'>{tr('ダウンロード済みの曲がありません')}</Text>
						</View>
					}
				/>
			</View>

			<ExportDownloadsProgressModal
				sheetRef={exportSheetRef}
				ids={exportConfig?.ids ?? []}
				destinationUri={exportConfig?.destinationUri ?? ''}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	listContainer: { flex: 1 },
	searchbar: {
		margin: 8,
		elevation: 0,
		backgroundColor: 'transparent',
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0,0,0,0.1)',
	},
	rectButton: { paddingVertical: 4 },
	surface: {
		overflow: 'hidden',
		borderRadius: LIST_ITEM_BORDER_RADIUS,
		backgroundColor: 'transparent',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	indexContainer: {
		width: 35,
		marginRight: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	checkboxContainer: { position: 'absolute' },
	titleContainer: { marginLeft: 12, flex: 1, marginRight: 4 },
	detailsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
	},
	dotSeparator: { marginHorizontal: 4 },
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 100,
	},
})
