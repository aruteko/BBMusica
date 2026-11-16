import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Text, TouchableRipple, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { MenuView, type MenuComponentRef } from '@/components/common/FunctionalMenu'
import type { TrackMenuItem } from '@/features/playlist/remote/components/PlaylistItem'
import StationHero from '@/features/home/StationHero'
import { useSearchInteractions } from '@/features/playlist/remote/search-result/hooks/useSearchInteractions'
import { useHomeRecommendations } from '@/hooks/queries/recommendations'
import {
	useMostPlayedTracks,
	useRecentlyPlayedTracks,
} from '@/hooks/queries/playHistory'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import { startStation } from '@/lib/player/station'
import { persistTracksToLocal } from '@/lib/services/recommendationService'
import type { Track } from '@/types/core/media'
import { addToQueue } from '@/utils/player'
import { AndroidHaptics, performHaptics } from '@/utils/haptics'
import toast from '@/utils/toast'
import { t as tr } from '@/i18n'
import { CORNER_RADIUS } from '@/theme/dimensions'

const CARD_SIZE = 128

interface TrackCardProps {
	track: Track
	onPress: (track: Track) => void
	/** 長押しで開くメニュー（検索結果の三点リーダーと同じ項目）。ない場合は長押しメニューなし */
	menuItems?: TrackMenuItem[]
}

const TrackCard = memo(function TrackCard({
	track,
	onPress,
	menuItems,
}: TrackCardProps) {
	const menuActions = useMenuActions(
		(menuItems ?? []).map(({ leadingIcon, ...item }) => ({
			...item,
			image: leadingIcon,
		})),
	)

	const menuRef = useRef<MenuComponentRef>(null)
	const hasMenu = !!menuItems && menuItems.length > 0

	return (
		<View style={styles.card}>
			<TouchableRipple
				onPress={() => onPress(track)}
				// 長押しでも同じメニューを開く
				onLongPress={hasMenu ? () => menuRef.current?.show() : undefined}
				style={styles.cardTouchable}
				borderless
				accessibilityLabel={`${track.title}${tr(' を再生')}`}
			>
				<View>
					<CoverWithPlaceHolder
						id={track.uniqueKey}
						cover={track.coverUrl}
						title={track.title}
						size={CARD_SIZE}
					/>
					<Text
						variant='bodyMedium'
						numberOfLines={2}
						style={styles.cardTitle}
					>
						{track.title}
					</Text>
					<Text
						variant='bodySmall'
						numberOfLines={1}
						style={styles.cardSubtitle}
					>
						{track.artist?.name ?? tr('不明なアーティスト')}
					</Text>
				</View>
			</TouchableRipple>

			{/*
			 * 長押しで開くメニュー。カード全体を MenuView で包むとうまく動かないため、
			 * 見えない小さなアンカーだけを包み、長押しから ref 経由で開く。
			 * アンカーはタッチを受けない（タップは再生に使う）。
			 */}
			{hasMenu && (
				<View
					style={styles.menuAnchorContainer}
					pointerEvents='none'
				>
					<MenuView
						ref={menuRef}
						{...menuActions}
					>
						<View style={styles.menuAnchor} />
					</MenuView>
				</View>
			)}
		</View>
	)
})

interface SectionProps {
	title: string
	tracks: Track[]
	loading?: boolean
}

/** 横向滚动的曲目区块。点击某首后，以该区块的曲目作为再生キュー。 */
const TrackSection = memo(function TrackSection({
	title,
	tracks,
	loading,
}: SectionProps) {
	const { colors } = useTheme()
	const { trackMenuItems } = useSearchInteractions()

	const handlePress = useCallback(
		(track: Track) => {
			// 点击时立刻震动（入库需要一点时间，不能等到开始播放才震动）
			void performHaptics(AndroidHaptics.Confirm)
			void (async () => {
				// 先入库再入队：否则播放器按 uniqueKey 读取当前曲目时会 TrackNotFound
				const persisted = await persistTracksToLocal(tracks)
				if (!persisted.some((t) => t.uniqueKey === track.uniqueKey)) {
					toast.error(tr('曲情報の保存に失敗しました'))
					return
				}
				await addToQueue({
					tracks: persisted,
					playNow: true,
					clearQueue: true,
					startFromKey: track.uniqueKey,
					playNext: false,
					haptic: false,
				})
			})()
		},
		[tracks],
	)

	if (!loading && tracks.length === 0) return null

	return (
		<View style={styles.section}>
			<View style={styles.sectionHeader}>
				<Text
					variant='titleMedium'
					style={styles.sectionTitle}
				>
					{title}
				</Text>
			</View>
			{loading && tracks.length === 0 ? (
				<ActivityIndicator
					style={styles.loading}
					color={colors.primary}
				/>
			) : (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.cardRow}
					keyboardShouldPersistTaps='handled'
				>
					{tracks.map((track) => (
						<TrackCard
							key={track.uniqueKey}
							track={track}
							onPress={handlePress}
							menuItems={
								track.source === 'bilibili' ? trackMenuItems(track) : undefined
							}
						/>
					))}
				</ScrollView>
			)}
		</View>
	)
})

/**
 * 首页的推荐内容：电台入口、最近聴いた曲、よく聴いている曲、あなたへのおすすめ。
 */
export default function HomeRecommendations() {
	const [stationLoading, setStationLoading] = useState(false)

	const recent = useRecentlyPlayedTracks(20)
	const frequent = useMostPlayedTracks(30, 12)
	const recommendations = useHomeRecommendations()

	const frequentTracks = useMemo<Track[]>(
		() => frequent.data?.map((item) => item.track) ?? [],
		[frequent.data],
	)

	// 大きく出した曲を起点に、ステーションを始める
	const handleStartStation = useCallback(async (seed: Track) => {
		setStationLoading(true)
		try {
			await startStation(seed)
		} finally {
			setStationLoading(false)
		}
	}, [])

	const recommendedTracks = recommendations.data?.tracks
	const heroTrack = recommendedTracks?.[0]
	return (
		<View>
			{/* 履歴もおすすめもない最初の起動では、ステーションの曲がないので出さない */}
			{heroTrack ? (
				<StationHero
					track={heroTrack}
					loading={stationLoading}
					onStart={(track) => void handleStartStation(track)}
				/>
			) : null}

			<TrackSection
				title={tr('最近聴いた曲')}
				tracks={recent.data ?? []}
			/>
			<TrackSection
				title={tr('よく聴いている曲')}
				tracks={frequentTracks}
			/>
			<TrackSection
				title={tr('あなたへのおすすめ')}
				tracks={recommendedTracks ?? []}
				loading={recommendations.isPending}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	section: { marginTop: 16 },
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	sectionTitle: { fontWeight: 'bold' },
	cardRow: { gap: 12 },
	card: { width: CARD_SIZE },
	cardTouchable: { width: CARD_SIZE, borderRadius: CORNER_RADIUS },
	// カバー画像の中央あたり（メニューはここを基準に開く）
	menuAnchorContainer: {
		position: 'absolute',
		top: CARD_SIZE / 2 - 12,
		left: CARD_SIZE / 2 - 12,
	},
	menuAnchor: { width: 24, height: 24 },
	cardTitle: { marginTop: 6 },
	cardSubtitle: { opacity: 0.7 },
	loading: { height: CARD_SIZE },
})
