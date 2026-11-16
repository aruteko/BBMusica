import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
import { useImage } from 'expo-image'
import { useObserve } from 'expo-observe'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import type { ViewInstance } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import { PlaylistHeader } from '@/features/playlist/local/components/LocalPlaylistHeader'
import { TrackListItem } from '@/features/playlist/local/components/LocalPlaylistItem'
import { LocalTrackList } from '@/features/playlist/local/components/LocalTrackList'
import { PlaylistError } from '@/features/playlist/local/components/PlaylistError'
import { PlaylistPlayerPreferenceDialog } from '@/features/playlist/local/components/PlaylistPlayerPreferenceDialog'
import { useLocalPlaylistMenu } from '@/features/playlist/local/hooks/useLocalPlaylistMenu'
import { useLocalPlaylistPlayer } from '@/features/playlist/local/hooks/useLocalPlaylistPlayer'
import { useTrackSelection } from '@/features/playlist/local/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import {
	useBatchDeleteTracksFromLocalPlaylist,
	useDeletePlaylist,
	useEditPlaylistMetadata,
	usePlaylistSync,
	useReorderLocalPlaylistTrack,
} from '@/hooks/mutations/db/playlist'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	useAllPlaylistsContainingTrack,
	usePlaylistContentsInfinite,
	usePlaylistMetadata,
	useSearchTracksInPlaylist,
} from '@/hooks/queries/db/playlist'
import { useBatchDownloadStatus } from '@/hooks/queries/orpheus'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { type MenuBuilder, useMenuActions } from '@/hooks/ui/useMenuActions'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { useIsActuallyOffline } from '@/hooks/utils/useIsActuallyOffline'
import { playlistService } from '@/lib/services/playlistService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'
import { t as tr } from '@/i18n'

const SORT_ICON = Icon.select({
	ios: 'arrow.up.and.down.text.horizontal',
	android: import('@expo/material-symbols/sort.xml'),
})

const EDIT_ICON = Icon.select({
	ios: 'pencil',
	android: import('@expo/material-symbols/edit.xml'),
})

const SYNC_ICON = Icon.select({
	ios: 'arrow.triangle.2.circlepath',
	android: import('@expo/material-symbols/sync.xml'),
})

const DELETE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const PIN_ICON = Icon.select({
	ios: 'pin.fill',
	android: import('@expo/material-symbols/keep.xml'),
})

const UNPIN_ICON = Icon.select({
	ios: 'pin',
	android: import('@expo/material-symbols/keep_off.xml'),
})

const PREFERRED_ICON = Icon.select({
	ios: 'headphones',
	android: import('@expo/material-symbols/headphones.xml'),
})

const SEARCHBAR_HEIGHT = 72
const SCOPE = 'UI.Playlist.Local'

const SELECT_MODE_ITEM_HEIGHT = 69

/** px from top/bottom edge of list container that triggers auto-scroll */
const EDGE_ZONE = 80
/** px scrolled per auto-scroll tick (~16 ms) */
const SCROLL_SPEED = 8

type PlaylistContentsData = NonNullable<
	ReturnType<typeof usePlaylistContentsInfinite>['data']
>
type PlaylistMetadata = NonNullable<
	ReturnType<typeof usePlaylistMetadata>['data']
>

export default function LocalPlaylistPage() {
	const isListReady = useScreenTransitionReady()
	const { id } = useLocalSearchParams<{ id: string }>()
	const { markInteractive } = useObserve()
	const router = useRouter()

	useEffect(() => {
		markInteractive()
	}, [markInteractive])
	const {
		data: playlistData,
		isPending: isPlaylistDataPending,
		isError: isPlaylistDataError,
		fetchNextPage: fetchNextPagePlaylistData,
		hasNextPage: hasNextPagePlaylistData,
		isFetchingNextPage: isFetchingNextPagePlaylistData,
	} = usePlaylistContentsInfinite(Number(id), 30, 15)
	const {
		data: playlistMetadata,
		isPending: isPlaylistMetadataPending,
		isError: isPlaylistMetadataError,
	} = usePlaylistMetadata(Number(id))

	// 歌单可能在打开后被删除（本地删除或远端删除），此时查询会返回 null。
	// 自动退出该页面，避免停留在无效页面，也不要把这种情况当作错误上报
	const isPlaylistNotFound =
		!isPlaylistMetadataPending &&
		!isPlaylistMetadataError &&
		playlistMetadata === null

	useEffect(() => {
		if (!isPlaylistNotFound) return
		toast.error(tr('プレイリストが存在しないか、削除されました'))
		if (router.canGoBack()) router.back()
		else router.replace('/(tabs)')
	}, [isPlaylistNotFound, router])

	if (typeof id !== 'string') return null
	if (isPlaylistDataPending || isPlaylistMetadataPending || !isListReady)
		return <PlaylistPageSkeleton animate={isListReady} />
	if (isPlaylistDataError || isPlaylistMetadataError)
		return <PlaylistError text={tr('プレイリストの内容を読み込めませんでした')} />
	if (!playlistData || !playlistMetadata)
		return <PlaylistError text={tr('プレイリストが存在しないか、削除されました')} />

	return (
		<LocalPlaylistContent
			id={id}
			playlistData={playlistData}
			fetchNextPagePlaylistData={fetchNextPagePlaylistData}
			hasNextPagePlaylistData={hasNextPagePlaylistData}
			isFetchingNextPagePlaylistData={isFetchingNextPagePlaylistData}
			playlistMetadata={playlistMetadata}
		/>
	)
}

function LocalPlaylistContent({
	id,
	playlistData,
	fetchNextPagePlaylistData,
	hasNextPagePlaylistData,
	isFetchingNextPagePlaylistData,
	playlistMetadata,
}: {
	id: string
	playlistData: PlaylistContentsData
	fetchNextPagePlaylistData: ReturnType<
		typeof usePlaylistContentsInfinite
	>['fetchNextPage']
	hasNextPagePlaylistData: boolean
	isFetchingNextPagePlaylistData: boolean
	playlistMetadata: PlaylistMetadata
}) {
	const theme = useTheme()
	const { colors } = theme
	const [playerPreferenceVisible, setPlayerPreferenceVisible] = useState(false)
	const [isResolvingSelection, setIsResolvingSelection] = useState(false)
	const router = useRouter()
	const [searchQuery, setSearchQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const searchbarHeight = useSharedValue(0)
	const deferredQuery = useDeferredValue(searchQuery)
	const {
		selected,
		selectMode,
		toggle,
		enterSelectMode,
		exitSelectMode,
		setSelected,
	} = useTrackSelection()

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()
	const currentTrack = useCurrentTrack()
	const selection = {
		active: selectMode,
		selected,
		toggle,
		enter: enterSelectMode,
	}
	const openModal = useModalStore((state) => state.open)

	const { data: playlistsContainingCurrentTrack } =
		useAllPlaylistsContainingTrack(currentTrack?.uniqueKey)
	const allLoadedTracks =
		(
			playlistData?.pages as Array<{
				tracks: Track[]
				sortKeys: string[]
				nextPageFirstSortKey?: string
			}>
		)?.flatMap((page) => page.tracks) ?? []
	/** DB `sort_key` values parallel to allLoadedTracks (needed for reorder mutation) */
	const allLoadedSortKeys =
		(
			playlistData?.pages as Array<{
				tracks: Track[]
				sortKeys: string[]
				nextPageFirstSortKey?: string
			}>
		)?.flatMap((page) => page.sortKeys) ?? []

	const isOffline = useIsActuallyOffline()

	const loadedTrackKeys = allLoadedTracks.map((t) => t.uniqueKey)
	const { data: downloadStatus } = useBatchDownloadStatus(loadedTrackKeys)

	const playableOfflineKeys = (() => {
		if (!allLoadedTracks.length) return new Set<string>()

		const keys = new Set<string>()
		const urisToCheck: { uniqueKey: string; uri: string }[] = []

		for (const track of allLoadedTracks) {
			if (track.source === 'local') {
				keys.add(track.uniqueKey)
				continue
			}
			const uri = getInternalPlayUri(track)
			if (uri) {
				urisToCheck.push({ uniqueKey: track.uniqueKey, uri })
			}
		}

		const validUris = new Set(
			Orpheus.getLruCachedUris(urisToCheck.map((u) => u.uri)),
		)
		for (const item of urisToCheck) {
			if (
				validUris.has(item.uri) ||
				downloadStatus?.[item.uniqueKey] === DownloadState.COMPLETED
			) {
				keys.add(item.uniqueKey)
			}
		}
		return keys
	})()

	const {
		data: searchData,
		isError: isSearchError,
		error: searchError,
	} = useSearchTracksInPlaylist(Number(id), deferredQuery, startSearch)

	const finalPlaylistData = (() => {
		if (!startSearch || !deferredQuery.trim()) {
			return allLoadedTracks
		}

		if (isSearchError) {
			toastAndLogError(tr('検索に失敗しました'), searchError, SCOPE)
			return []
		}

		return searchData ?? []
	})()
	const currentTrackKey = currentTrack?.uniqueKey
	const currentTrackIndex = useMemo(
		() =>
			currentTrackKey
				? finalPlaylistData.findIndex(
						(track) => track.uniqueKey === currentTrackKey,
					)
				: -1,
		[finalPlaylistData, currentTrackKey],
	)
	const [visibleTrackKeys, setVisibleTrackKeys] = useState<string[]>([])
	const [isLocatingCurrentTrack, setIsLocatingCurrentTrack] = useState(false)
	const lastCurrentTrackLookupPageCountRef = useRef<number | null>(null)

	const isCurrentTrackInPlaylist = playlistsContainingCurrentTrack?.some(
		(playlist) => playlist.id === Number(id),
	)
	const isCurrentTrackVisible =
		!currentTrackKey || visibleTrackKeys.includes(currentTrackKey)

	const handleViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: { item: Track }[] }) => {
			setVisibleTrackKeys(viewableItems.map(({ item }) => item.uniqueKey))
		},
		[],
	)

	const locateCurrentTrack = useCallback(() => {
		lastCurrentTrackLookupPageCountRef.current = null
		setIsLocatingCurrentTrack(true)
	}, [])

	useEffect(() => {
		if (!isLocatingCurrentTrack || !currentTrackKey) return

		if (currentTrackIndex !== -1) {
			void listRef.current?.scrollToIndex({
				index: currentTrackIndex,
				animated: true,
				viewPosition: 0.5,
			})
			setVisibleTrackKeys((keys) =>
				keys.includes(currentTrackKey) ? keys : [...keys, currentTrackKey],
			)
			setIsLocatingCurrentTrack(false)
			return
		}

		if (hasNextPagePlaylistData && !isFetchingNextPagePlaylistData) {
			const loadedPageCount = playlistData?.pages.length ?? 0
			if (lastCurrentTrackLookupPageCountRef.current === loadedPageCount) {
				setIsLocatingCurrentTrack(false)
				return
			}
			lastCurrentTrackLookupPageCountRef.current = loadedPageCount
			void fetchNextPagePlaylistData().catch(() => {
				setIsLocatingCurrentTrack(false)
			})
			return
		}

		if (!hasNextPagePlaylistData) {
			setIsLocatingCurrentTrack(false)
		}
	}, [
		currentTrackIndex,
		currentTrackKey,
		fetchNextPagePlaylistData,
		hasNextPagePlaylistData,
		isFetchingNextPagePlaylistData,
		isLocatingCurrentTrack,
		listRef,
		playlistData?.pages.length,
	])

	const coverRef = useImage(
		resolveBilibiliImageUrl(playlistMetadata?.coverUrl) ?? '',
		{
			onError: () => void 0,
		},
	)

	const {
		backgroundColor,
		primaryButtonColor,
		primaryButtonTextColor,
		secondaryButtonContainerColor,
		secondaryButtonIconColor,
	} = usePlaylistBackgroundColor(coverRef, theme.dark, colors.background)

	const { mutate: syncPlaylist } = usePlaylistSync()
	const { mutate: deletePlaylist } = useDeletePlaylist()
	const { mutate: editPlaylistMetadata } = useEditPlaylistMetadata()
	const { mutate: deleteTrackFromLocalPlaylist } =
		useBatchDeleteTracksFromLocalPlaylist()
	const { mutate: reorderTrack } = useReorderLocalPlaylistTrack()
	const onClickDeletePlaylist = () => {
		deletePlaylist(
			{ playlistId: Number(id) },
			{ onSuccess: () => router.back() },
		)
	}

	const handleSync = () => {
		if (!playlistMetadata || !playlistMetadata.remoteSyncId) {
			toast.error(
				tr('同期できません：プレイリスト情報がありません'),
			)
			return
		}

		if (playlistMetadata.type === 'favorite') {
			const { expandMultiPageOnSync } = useAppStore.getState().settings
			if (expandMultiPageOnSync === null) {
				openModal('SyncOptions', {
					favoriteId: playlistMetadata.remoteSyncId,
				})
				return
			}
			openModal(
				'PlaylistSyncProgress',
				{
					remoteId: playlistMetadata.remoteSyncId,
					type: 'favorite',
					expandMultiPage: expandMultiPageOnSync,
				},
				{ dismissible: false },
			)
			return
		}

		if (playlistMetadata.type === 'series') {
			openModal(
				'PlaylistSyncProgress',
				{
					remoteId: playlistMetadata.remoteSyncId,
					type: 'series',
				},
				{ dismissible: false },
			)
			return
		}

		const toastId = 'sync-playlist'
		toast.show(tr('同期中...'), { id: toastId, duration: Infinity })
		syncPlaylist({
			remoteSyncId: playlistMetadata.remoteSyncId,
			type: playlistMetadata.type,
			toastId,
		})
	}

	const { playAll, handleTrackPress } = useLocalPlaylistPlayer(
		Number(id),
		isOffline,
		playableOfflineKeys,
	)

	const deleteTrack = (trackId: number) => {
		deleteTrackFromLocalPlaylist({
			trackIds: [trackId],
			playlistId: Number(id),
		})
	}

	const trackMenuItems = useLocalPlaylistMenu({
		deleteTrack,
		openAddToPlaylistModal: (track) =>
			openModal('UpdateTrackLocalPlaylists', { track }),
		openEditTrackModal: (track) => openModal('EditTrackMetadata', { track }),
		playlist: playlistMetadata,
		isReadOnly: false,
	})

	const deleteSelectedTracks = () => {
		if (selected.size === 0) return
		deleteTrackFromLocalPlaylist({
			trackIds: Array.from(selected),
			playlistId: Number(id),
		})
		exitSelectMode()
	}

	const clearInvalidVideos = async () => {
		const tracksResult = await playlistService.getPlaylistTracks(Number(id))
		if (tracksResult.isErr()) {
			toastAndLogError(tr('プレイリストの曲を取得できませんでした'), tracksResult.error, SCOPE)
			return
		}

		const invalidTrackIds = tracksResult.value
			.filter(
				(track) =>
					track.source === 'bilibili' && !track.bilibiliMetadata.videoIsValid,
			)
			.map((track) => track.id)
		if (invalidTrackIds.length === 0) {
			toast.info(tr('削除が必要な無効な動画はありません'))
			return
		}

		deleteTrackFromLocalPlaylist({
			trackIds: invalidTrackIds,
			playlistId: Number(id),
		})
	}

	const getSelectionScopeTracks = async () => {
		const tracksResult =
			startSearch && deferredQuery.trim()
				? await playlistService.searchTrackInPlaylist(Number(id), deferredQuery)
				: await playlistService.getPlaylistTracks(Number(id))
		if (tracksResult.isErr()) {
			toastAndLogError(tr('プレイリストの曲を取得できませんでした'), tracksResult.error, SCOPE)
			return null
		}
		return tracksResult.value
	}

	const selectAllTracks = async () => {
		setIsResolvingSelection(true)
		try {
			const tracks = await getSelectionScopeTracks()
			if (!tracks) {
				setIsResolvingSelection(false)
				return
			}
			setSelected(new Set(tracks.map((track) => track.id)))
			setIsResolvingSelection(false)
		} catch {
			setIsResolvingSelection(false)
		}
	}

	const invertSelectedTracks = async () => {
		setIsResolvingSelection(true)
		try {
			const tracks = await getSelectionScopeTracks()
			if (!tracks) {
				setIsResolvingSelection(false)
				return
			}
			setSelected(
				new Set(
					tracks
						.filter((track) => !selected.has(track.id))
						.map((track) => track.id),
				),
			)
			setIsResolvingSelection(false)
		} catch {
			setIsResolvingSelection(false)
		}
	}

	const openBatchAddTracksModal = async () => {
		setIsResolvingSelection(true)
		try {
			const tracksResult = await playlistService.getPlaylistTracks(Number(id))
			if (tracksResult.isErr()) {
				toastAndLogError(tr('プレイリストの曲を取得できませんでした'), tracksResult.error, SCOPE)
				setIsResolvingSelection(false)
				return
			}
			const selectedTracks = tracksResult.value.filter((track) =>
				selected.has(track.id),
			)
			openModal('BatchAddTracksToLocalPlaylist', {
				payloads: selectedTracks.map((track) => ({
					track: { ...track, artistId: track.artist?.id },
					artist: track.artist!,
				})),
			})
			setIsResolvingSelection(false)
		} catch {
			setIsResolvingSelection(false)
		}
	}

	useEffect(() => {
		if (typeof id !== 'string') {
			router.replace('/+not-found')
		}
	}, [id, router])

	usePreventRemove(startSearch || selectMode, () => {
		if (startSearch) setStartSearch(false)
		if (selectMode) exitSelectMode()
	})

	useEffect(() => {
		searchbarHeight.set(
			withTiming(startSearch ? SEARCHBAR_HEIGHT : 0, { duration: 180 }),
		)
	}, [searchbarHeight, startSearch])

	const searchbarAnimatedStyle = useAnimatedStyle(() => ({
		height: searchbarHeight.value,
	}))

	const [dragging, setDragging] = useState<{
		trackIndex: number
		trackId: number
	} | null>(null)

	/** Index AFTER which to show the insertion line (-1 = before item 0) */
	const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null)

	/** Ghost Y relative to the list container */
	const ghostY = useSharedValue(0)

	const dragOriginRef = useRef(0)
	/** Absolute screen Y of the top of the list container (from measureInWindow) */
	const containerTopRef = useRef(0)
	const containerHeightRef = useRef(0)
	const listContainerRef = useRef<ViewInstance>(null)

	/** Current list scroll offset */
	const scrollOffsetRef = useRef(0)

	/** Auto-scroll interval handle */
	const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const stopAutoScroll = useCallback(() => {
		if (autoScrollRef.current !== null) {
			clearInterval(autoScrollRef.current)
			autoScrollRef.current = null
		}
	}, [autoScrollRef])

	// 组件卸载时清理自动滚动定时器
	useEffect(() => {
		return () => stopAutoScroll()
	}, [stopAutoScroll])

	const startAutoScroll = (direction: 'up' | 'down') => {
		stopAutoScroll()
		autoScrollRef.current = setInterval(async () => {
			const delta = direction === 'down' ? SCROLL_SPEED : -SCROLL_SPEED
			const next = Math.max(0, scrollOffsetRef.current + delta)
			await listRef.current?.scrollToOffset({ offset: next, animated: false })
			scrollOffsetRef.current = next
		}, 16)
	}

	const updateDragPosition = (absoluteY: number) => {
		// Ghost: center it on the finger relative to the container
		ghostY.set(
			absoluteY - containerTopRef.current - SELECT_MODE_ITEM_HEIGHT / 2,
		)

		// Insert index: use calibration so that item-0 touches the origin correctly
		const hoverRel = absoluteY + scrollOffsetRef.current - dragOriginRef.current
		const k = Math.floor(hoverRel / SELECT_MODE_ITEM_HEIGHT)
		// Upper/lower half of item k determines whether to insert before or after
		const inItemFrac =
			(hoverRel - k * SELECT_MODE_ITEM_HEIGHT) / SELECT_MODE_ITEM_HEIGHT
		const insertIdx = inItemFrac >= 0.5 ? k : k - 1
		setInsertAfterIndex(
			Math.max(-1, Math.min(insertIdx, finalPlaylistData.length - 1)),
		)

		// Edge auto-scroll
		const containerRelY = absoluteY - containerTopRef.current
		if (containerRelY < EDGE_ZONE) {
			startAutoScroll('up')
		} else if (containerRelY > containerHeightRef.current - EDGE_ZONE) {
			startAutoScroll('down')
		} else {
			stopAutoScroll()
		}
	}

	const draggingRef = useRef(dragging)
	const insertAfterIndexRef = useRef(insertAfterIndex)
	useEffect(() => {
		draggingRef.current = dragging
	}, [dragging])
	useEffect(() => {
		insertAfterIndexRef.current = insertAfterIndex
	}, [insertAfterIndex])

	const handleDragStart = (
		trackIndex: number,
		trackId: number,
		absoluteY: number,
	) => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Long_Press)
		// Calibrate: store the virtual Y-origin so item i is at origin + i * H
		dragOriginRef.current =
			absoluteY + scrollOffsetRef.current - trackIndex * SELECT_MODE_ITEM_HEIGHT
		setDragging({ trackIndex, trackId })
		// Ghost starts centered on the finger
		ghostY.set(
			absoluteY - containerTopRef.current - SELECT_MODE_ITEM_HEIGHT / 2,
		)
		setInsertAfterIndex(trackIndex - 1)
	}

	const handleDragUpdate = updateDragPosition

	const handleDragEnd = () => {
		stopAutoScroll()
		const currentDragging = draggingRef.current
		const currentInsertAfterIndex = insertAfterIndexRef.current

		if (!currentDragging || currentInsertAfterIndex === null) {
			setDragging(null)
			setInsertAfterIndex(null)
			return
		}

		const { trackIndex, trackId } = currentDragging

		// Adjust target visual index based on drag direction
		const targetVisualIndex =
			currentInsertAfterIndex >= trackIndex
				? currentInsertAfterIndex
				: currentInsertAfterIndex + 1

		if (targetVisualIndex !== trackIndex) {
			const clamped = Math.max(
				0,
				Math.min(targetVisualIndex, finalPlaylistData.length - 1),
			)
			// 显示为 DESC 排序：index 0 = 最高 sort_key，index N-1 = 最低 sort_key
			// 向下拖（clamped > trackIndex）：新位置夹在 [clamped] 和 [clamped+1] 之间
			// 向上拖（clamped < trackIndex）：新位置夹在 [clamped-1] 和 [clamped] 之间
			let prevSortKey: string | null
			let nextSortKey: string | null
			if (targetVisualIndex > trackIndex) {
				// 向列表底部方向移动（sort_key 降低）
				// 如果已经到了加载的末尾，且还有下一页，那么 prevSortKey 应该是下一页的第一条的 key
				const isAtEnd = clamped === allLoadedSortKeys.length - 1
				const nextPageFirstSortKey =
					playlistData?.pages[playlistData.pages.length - 1]
						?.nextPageFirstSortKey
				prevSortKey =
					allLoadedSortKeys[clamped + 1] ??
					(isAtEnd && hasNextPagePlaylistData ? nextPageFirstSortKey : null) ??
					null
				nextSortKey = allLoadedSortKeys[clamped] ?? null
			} else {
				// 向列表顶部方向移动（sort_key 升高）
				prevSortKey = allLoadedSortKeys[clamped] ?? null
				nextSortKey = allLoadedSortKeys[clamped - 1] ?? null
			}
			reorderTrack({
				playlistId: Number(id),
				trackId,
				prevSortKey,
				nextSortKey,
			})
		}

		setDragging(null)
		setInsertAfterIndex(null)
	}

	const ghostAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: ghostY.value }],
	}))

	const draggedTrack =
		dragging !== null ? finalPlaylistData[dragging.trackIndex] : null

	const menuActions = useMenuActions(addPlaylistMenuItems)

	function addPlaylistMenuItems(menu: MenuBuilder) {
		const isLocal = playlistMetadata.type === 'local'

		menu.add({
			title: tr('プレーヤー設定'),
			image: PREFERRED_ICON,
			onPress: () => setPlayerPreferenceVisible(true),
		})

		if (isLocal) {
			menu.add({
				title: tr('並べ替え'),
				image: SORT_ICON,
				onPress: enterSelectMode,
			})
		}

		menu.add({
			title: tr('プレイリスト情報を編集'),
			image: EDIT_ICON,
			onPress: () => {
				openModal('EditPlaylistMetadata', { playlist: playlistMetadata })
			},
		})

		if (
			isLocal &&
			playlistMetadata.validTrackCount < playlistMetadata.itemCount
		) {
			menu.add({
				title: tr('無効な動画を削除'),
				image: DELETE_ICON,
				attributes: { destructive: true },
				onPress: () => {
					alert(
						tr('無効な動画を削除'),
						tr('プレイリストからすべての無効な動画を削除しますか？'),
						[
							{ text: tr('キャンセル') },
							{ text: tr('OK'), onPress: () => void clearInvalidVideos() },
						],
						{ cancelable: true },
					)
				},
			})
		}

		if (
			isLocal &&
			playlistMetadata.remoteSyncId === null
		) {
			menu.add({
				title: tr('B站に同期'),
				image: SYNC_ICON,
				onPress: () => {
					openModal(
						'SyncLocalToBilibili',
						{ playlistId: playlistMetadata.id },
						{ dismissible: false },
					)
				},
			})
		}

		menu.add({
			title: playlistMetadata.isPinned ? tr('ピン留め解除') : tr('ピン留め'),
			image: playlistMetadata.isPinned ? UNPIN_ICON : PIN_ICON,
			onPress: () => {
				editPlaylistMetadata({
					playlistId: playlistMetadata.id,
					payload: {
						isPinned: !playlistMetadata.isPinned,
					},
				})
			},
		})

		menu.add({
			title: tr('プレイリストを削除'),
			image: DELETE_ICON,
			attributes: { destructive: true },
			onPress: () => {
				alert(
					tr('プレイリストを削除'),
					tr('このプレイリストを削除しますか？'),
					[{ text: tr('キャンセル') }, { text: tr('OK'), onPress: onClickDeletePlaylist }],
					{ cancelable: true },
				)
			},
		})
	}

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<PlaylistPlayerPreferenceDialog
				playlist={playlistMetadata}
				visible={playerPreferenceVisible}
				onDismiss={() => setPlayerPreferenceVisible(false)}
			/>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title={
						selectMode
							? `${selected.size}${tr('\u2009曲を選択中')}`
							: playlistMetadata.title
					}
					onPress={handleDoubleTap}
				/>
				{selectMode ? (
					<>
						<Appbar.Action
							icon='select-all'
							disabled={isResolvingSelection}
							onPress={() => void selectAllTracks()}
						/>
						<Appbar.Action
							icon='select-compare'
							disabled={isResolvingSelection}
							onPress={() => void invertSelectedTracks()}
						/>
						{playlistMetadata.type === 'local' && (
							<Appbar.Action
								icon='trash-can'
								onPress={() =>
									alert(
										tr('曲を削除'),
										tr('プレイリストからこれらの曲を削除しますか？'),
										[
											{ text: tr('キャンセル') },
											{ text: tr('OK'), onPress: deleteSelectedTracks },
										],
										{ cancelable: true },
									)
								}
							/>
						)}
						<Appbar.Action
							icon='playlist-plus'
							disabled={isResolvingSelection}
							onPress={() => void openBatchAddTracksModal()}
						/>
					</>
				) : (
					<>
						<Appbar.Action
							icon={startSearch ? 'close' : 'magnify'}
							onPress={() => setStartSearch((prev) => !prev)}
						/>
						<MenuView {...menuActions}>
							<Appbar.Action
								icon='dots-vertical'
								testID='local-playlist-menu'
								accessibilityLabel={tr('プレイリスト操作')}
							/>
						</MenuView>
					</>
				)}
			</Appbar.Header>

			{/* 搜索框 */}
			<Animated.View
				style={[styles.searchbarContainer, searchbarAnimatedStyle]}
			>
				<SearchBar
					placeholder={tr('曲を検索')}
					onChangeText={setSearchQuery}
					value={searchQuery}
				/>
			</Animated.View>

			<View
				ref={listContainerRef}
				style={{ flex: 1 }}
				onLayout={() => {
					listContainerRef.current?.measureInWindow((_x, y, _w, h) => {
						containerTopRef.current = y
						containerHeightRef.current = h
					})
				}}
			>
				<LocalTrackList
					listRef={listRef}
					isStale={searchQuery !== deferredQuery}
					tracks={finalPlaylistData ?? []}
					playlist={playlistMetadata}
					handleTrackPress={handleTrackPress}
					trackMenuItems={trackMenuItems}
					selection={selection}
					isOffline={isOffline}
					isSearching={startSearch}
					playableOfflineKeys={playableOfflineKeys}
					onEndReached={
						hasNextPagePlaylistData &&
						!startSearch &&
						!isFetchingNextPagePlaylistData
							? () => fetchNextPagePlaylistData()
							: undefined
					}
					onDragStart={
						selectMode &&
						playlistMetadata.type === 'local' &&
						!startSearch
							? handleDragStart
							: undefined
					}
					onDragUpdate={
						selectMode &&
						playlistMetadata.type === 'local' &&
						!startSearch
							? handleDragUpdate
							: undefined
					}
					onDragEnd={
						selectMode &&
						playlistMetadata.type === 'local' &&
						!startSearch
							? handleDragEnd
							: undefined
					}
					insertAfterIndex={dragging !== null ? insertAfterIndex : null}
					onViewableItemsChanged={handleViewableItemsChanged}
					viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
					onScroll={(e) => {
						scrollOffsetRef.current = e.nativeEvent.contentOffset.y
					}}
					ListHeaderComponent={
						<>
							<PlaylistHeader
								coverRef={coverRef}
								playlist={playlistMetadata}
								totalDuration={playlistMetadata.totalDuration}
								onClickPlayAll={playAll}
								onClickSync={handleSync}
								onClickCopyToLocalPlaylist={() =>
									openModal('DuplicateLocalPlaylist', {
										sourcePlaylistId: Number(id),
										rawName: playlistMetadata.title,
									})
								}
								onPressAuthor={(author) =>
									author.remoteId &&
									router.navigate({
										pathname: '/playlist/remote/uploader/[mid]',
										params: { mid: author.remoteId },
									})
								}
								primaryButtonColor={primaryButtonColor}
								primaryButtonTextColor={primaryButtonTextColor}
								secondaryButtonContainerColor={secondaryButtonContainerColor}
								secondaryButtonIconColor={secondaryButtonIconColor}
							/>
						</>
					}
				/>
				{isCurrentTrackInPlaylist && !startSearch && !isCurrentTrackVisible && (
					<View style={styles.locateCurrentTrackButton}>
						<IconButton
							icon='crosshairs-gps'
							mode='contained'
							size={32}
							loading={isLocatingCurrentTrack}
							onPress={locateCurrentTrack}
							accessibilityLabel={tr('再生中の曲に移動')}
							testID='local-playlist-scroll-to-current'
						/>
					</View>
				)}

				{dragging !== null && draggedTrack && (
					<Animated.View
						pointerEvents='none'
						style={[styles.ghostContainer, ghostAnimatedStyle]}
					>
						<View style={styles.ghostInner}>
							<TrackListItem
								index={dragging.trackIndex}
								data={draggedTrack}
								playlist={playlistMetadata}
								selectMode={true}
								isSelected={false}
								toggleSelected={() => void 0}
								enterSelectMode={() => void 0}
								onTrackPress={() => void 0}
								onMenuPress={() => void 0}
							/>
						</View>
					</Animated.View>
				)}
			</View>

		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	searchbarContainer: { overflow: 'hidden' },
	locateCurrentTrackButton: {
		position: 'absolute',
		right: 16,
		bottom: 86,
	},
	ghostContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
	},
	ghostInner: {
		opacity: 0.85,
		elevation: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
	},
})
