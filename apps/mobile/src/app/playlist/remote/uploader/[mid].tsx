import { useImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import Button from '@/components/common/Button'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { startStation } from '@/lib/player/station'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { useSetUserFollowing } from '@/hooks/mutations/bilibili/relations'
import { useUserRelation } from '@/hooks/queries/bilibili/relations'
import {
	useInfiniteGetUserUploadedVideos,
	useOtherUserInfo,
	usePersonalInformation,
} from '@/hooks/queries/bilibili/user'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { useDebouncedValue } from '@/hooks/utils/useDebouncedValue'
import { bv2av } from '@/lib/api/bilibili/utils'
import type {
	BilibiliUserInfo,
	BilibiliUserUploadedVideosResponse,
} from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import { formatMMSSToSeconds } from '@/utils/time'

const SEARCHBAR_HEIGHT = 72

const mapApiItemToTrack = (
	apiItem: BilibiliUserUploadedVideosResponse['list']['vlist'][0],
	uploaderData: BilibiliUserInfo,
): BilibiliTrack => {
	return {
		id: bv2av(apiItem.bvid),
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title,
		artist: {
			id: uploaderData.mid,
			name: uploaderData.name,
			avatarUrl: uploaderData.face,
			source: 'bilibili',
			remoteId: uploaderData.mid.toString(),
			createdAt: new Date(apiItem.created),
			updatedAt: new Date(apiItem.created),
		},
		coverUrl: apiItem.pic,
		duration: formatMMSSToSeconds(apiItem.length),
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
		createdAt: new Date(apiItem.created),
		updatedAt: new Date(apiItem.created),
	}
}

export default function UploaderPage() {
	const isListReady = useScreenTransitionReady()
	const { mid } = useLocalSearchParams<{ mid: string }>()
	const theme = useTheme()
	const { colors } = theme
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const enable = useAppStore((state) => state.hasBilibiliCookie())
	const accountMid = useAppStore((state) => state.bilibiliCookie?.DedeUserID)
	const { data: personalInfo } = usePersonalInformation()
	const isSelf = Number(accountMid ?? personalInfo?.mid) === Number(mid)
	const relation = useUserRelation(Number(mid))
	const setFollowing = useSetUserFollowing(Number(mid))
	const followingBusy = useRef(false)
	const isFollowing =
		relation.data?.attribute === 2 || relation.data?.attribute === 6
	const isBlocked = relation.data?.attribute === 128
	const handleFollowing = async () => {
		if (followingBusy.current) return
		if (relation.isError) {
			void relation.refetch()
			return
		}
		if (!relation.data || isSelf || isBlocked) return
		followingBusy.current = true
		try {
			await setFollowing.mutateAsync(!isFollowing)
		} catch {
			// The mutation reports the error without changing the displayed relationship.
		} finally {
			followingBusy.current = false
		}
	}

	const { selected, selectMode, toggle, enterSelectMode, exitSelectMode } =
		useTrackSelection()

	const selection = useMemo(
		() => ({
			active: selectMode,
			selected,
			toggle,
			enter: enterSelectMode,
		}),
		[selectMode, selected, toggle, enterSelectMode],
	)

	const [searchQuery, setSearchQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const searchbarHeight = useSharedValue(0)
	const debouncedQuery = useDebouncedValue(searchQuery, 200)
	const openModal = useModalStore((state) => state.open)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()

	const searchbarAnimatedStyle = useAnimatedStyle(() => ({
		height: searchbarHeight.value,
	}))

	useEffect(() => {
		searchbarHeight.set(
			withTiming(startSearch ? SEARCHBAR_HEIGHT : 0, { duration: 180 }),
		)
	}, [searchbarHeight, startSearch])

	const {
		data: uploadedVideos,
		isPending: isUploadedVideosPending,
		isError: isUploadedVideosError,
		fetchNextPage,
		refetch,
		hasNextPage,
	} = useInfiniteGetUserUploadedVideos(Number(mid), debouncedQuery)

	const {
		data: uploaderUserInfo,
		isPending: isUserInfoPending,
		isError: isUserInfoError,
	} = useOtherUserInfo(Number(mid))

	const tracks = useMemo(() => {
		if (!uploadedVideos || !uploaderUserInfo) return []
		return uploadedVideos.pages
			.flatMap((page) => page.list.vlist)
			.map((item) => mapApiItemToTrack(item, uploaderUserInfo))
	}, [uploadedVideos, uploaderUserInfo])

	const coverRef = useImage(
		resolveBilibiliImageUrl(uploaderUserInfo?.face) ?? '',
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

	const { playTrack } = useRemotePlaylist()

	const trackMenuItems = usePlaylistMenu(playTrack)

	useEffect(() => {
		if (typeof mid !== 'string') {
			router.replace('/+not-found')
		}
	}, [mid, router])

	usePreventRemove(startSearch || selectMode, () => {
		if (startSearch) setStartSearch(false)
		if (selectMode) exitSelectMode()
	})

	if (typeof mid !== 'string') {
		return null
	}

	if (!enable) {
		return (
			<View
				style={[styles.loginContainer, { backgroundColor: colors.background }]}
			>
				<Text
					variant='titleMedium'
					style={styles.loginText}
				>
					Bilibiliアカウントにログインすると、投稿者の動画を確認できます
					{'\n\n'}
					理由：Bilibili
					ユーザーのスペースや投稿動画のAPIに、厳しいリスク制御があるためです
				</Text>
				<Button
					mode='contained'
					onPress={() => {
						router.navigate('/settings/bilibili-account/qrcode-login')
					}}
				>
					ログイン
				</Button>
			</View>
		)
	}

	if (isUserInfoPending || !isListReady) {
		return <PlaylistPageSkeleton animate={isListReady} />
	}

	if (isUploadedVideosPending && !startSearch) {
		return <PlaylistPageSkeleton animate={isListReady} />
	}

	if (isUploadedVideosError || isUserInfoError) {
		return <PlaylistError text='読み込みに失敗しました' />
	}

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.Content
					title={
						selectMode
							? `${selected.size}\u2009曲を選択中`
							: uploaderUserInfo.name
					}
					onPress={handleDoubleTap}
				/>
				<Appbar.BackAction onPress={() => router.back()} />
				{selectMode ? (
					<>
						<Appbar.Action
							icon='playlist-plus'
							onPress={() => {
								const payloads = []
								for (const id of selected) {
									const track = tracks.find((t) => t.id === id)
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
					<>
						<Appbar.Action
							icon='radio-tower'
							accessibilityLabel='この投稿者のステーション'
							disabled={tracks.length === 0}
							onPress={() => void startStation(tracks.slice(0, 5))}
						/>
						<Appbar.Action
							icon={startSearch ? 'close' : 'magnify'}
							onPress={() => setStartSearch((prev) => !prev)}
						/>
					</>
				)}
			</Appbar.Header>

			{/* 搜索框 */}
			<Animated.View
				style={[styles.searchbarContainer, searchbarAnimatedStyle]}
			>
				<SearchBar
					placeholder='曲を検索'
					onChangeText={setSearchQuery}
					value={searchQuery}
				/>
			</Animated.View>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={tracks ?? []}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					ListHeaderComponent={
						<PlaylistHeader
							cover={coverRef ?? undefined}
							title={uploaderUserInfo.name}
							subtitles={`${uploadedVideos?.pages[0].page.count ?? 0}\u2009曲`}
							description={uploaderUserInfo.sign}
							onClickMainButton={isSelf ? undefined : handleFollowing}
							mainButtonIcon={isFollowing ? 'account-check' : 'account-plus'}
							mainButtonText={
								setFollowing.isPending
									? '処理中'
									: relation.isError
										? 'フォロー状態の取得に失敗しました。再試行'
										: isBlocked
											? 'ブロック中'
											: relation.isPending
												? 'フォロー状態を読み込み中'
												: isFollowing
													? 'フォロー解除'
													: '投稿者をフォロー'
							}
							mainButtonLoading={setFollowing.isPending || relation.isFetching}
							disableMainButton={
								setFollowing.isPending || relation.isFetching || isBlocked
							}
							id={Number(mid)}
							primaryButtonColor={primaryButtonColor}
							primaryButtonTextColor={primaryButtonTextColor}
							secondaryButtonContainerColor={secondaryButtonContainerColor}
							secondaryButtonIconColor={secondaryButtonIconColor}
						/>
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true)
								await Promise.all([refetch(), relation.refetch()])
								setRefreshing(false)
							}}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					hasNextPage={hasNextPage}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	loginContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
		paddingHorizontal: 25,
	},
	loginText: {
		textAlign: 'center',
	},
	container: {
		flex: 1,
	},
	searchbarContainer: {
		overflow: 'hidden',
	},
	listContainer: {
		flex: 1,
	},
})
