import { memo, useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import {
	recommendationKeys,
	useHomeRecommendations,
	usePopularMusic,
} from '@/hooks/queries/recommendations'
import {
	useMostPlayedTracks,
	useRecentlyPlayedTracks,
} from '@/hooks/queries/playHistory'
import { queryClient } from '@/lib/config/queryClient'
import { startStation } from '@/lib/player/station'
import { persistTracksToLocal } from '@/lib/services/recommendationService'
import type { Track } from '@/types/core/media'
import { addToQueue } from '@/utils/player'
import { AndroidHaptics, performHaptics } from '@/utils/haptics'
import toast from '@/utils/toast'

const CARD_SIZE = 128

interface TrackCardProps {
	track: Track
	onPress: (track: Track) => void
}

const TrackCard = memo(function TrackCard({ track, onPress }: TrackCardProps) {
	return (
		<TouchableRipple
			onPress={() => onPress(track)}
			style={styles.card}
			borderless
			accessibilityLabel={`${track.title} を再生`}
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
					{track.artist?.name ?? '不明なアーティスト'}
				</Text>
			</View>
		</TouchableRipple>
	)
})

interface SectionProps {
	title: string
	tracks: Track[]
	loading?: boolean
	onRefresh?: () => void
}

/** 横向滚动的曲目区块。点击某首后，以该区块的曲目作为再生キュー。 */
const TrackSection = memo(function TrackSection({
	title,
	tracks,
	loading,
	onRefresh,
}: SectionProps) {
	const { colors } = useTheme()

	const handlePress = useCallback(
		(track: Track) => {
			// 点击时立刻震动（入库需要一点时间，不能等到开始播放才震动）
			void performHaptics(AndroidHaptics.Confirm)
			void (async () => {
				// 先入库再入队：否则播放器按 uniqueKey 读取当前曲目时会 TrackNotFound
				const persisted = await persistTracksToLocal(tracks)
				if (!persisted.some((t) => t.uniqueKey === track.uniqueKey)) {
					toast.error('曲情報の保存に失敗しました')
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
				{onRefresh && (
					<IconButton
						icon='refresh'
						size={20}
						accessibilityLabel={`${title}を更新`}
						onPress={onRefresh}
					/>
				)}
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
						/>
					))}
				</ScrollView>
			)}
		</View>
	)
})

/**
 * 首页的推荐内容：电台入口、よく聴いている曲、あなたへのおすすめ、人気の音楽。
 */
export default function HomeRecommendations() {
	const { colors } = useTheme()
	const [stationLoading, setStationLoading] = useState(false)

	const recent = useRecentlyPlayedTracks(20)
	const frequent = useMostPlayedTracks(30, 12)
	const recommendations = useHomeRecommendations()
	const popular = usePopularMusic()

	const frequentTracks = useMemo<Track[]>(
		() => frequent.data?.map((item) => item.track) ?? [],
		[frequent.data],
	)

	const handleStartStation = useCallback(async () => {
		setStationLoading(true)
		try {
			await startStation()
		} finally {
			setStationLoading(false)
		}
	}, [])

	const refreshRecommendations = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: recommendationKeys.home() })
	}, [])

	const recommendedTracks = recommendations.data?.tracks
	const recommendedKeys = useMemo(
		() => new Set(recommendedTracks?.map((t) => t.uniqueKey)),
		[recommendedTracks],
	)
	// 人気の音楽里去掉已经出现在「あなたへのおすすめ」中的曲目，避免两个区块重复
	const popularTracks = useMemo(
		() => popular.data?.filter((t) => !recommendedKeys.has(t.uniqueKey)) ?? [],
		[popular.data, recommendedKeys],
	)

	return (
		<View>
			<View
				style={[
					styles.stationCard,
					{ backgroundColor: colors.secondaryContainer },
				]}
			>
				<View style={styles.stationText}>
					<Text
						variant='titleMedium'
						style={{ color: colors.onSecondaryContainer }}
					>
						おすすめステーション
					</Text>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSecondaryContainer }}
					>
						よく聴く曲をもとに、似た音楽を自動で連続再生します
					</Text>
				</View>
				<Button
					mode='contained'
					icon='radio-tower'
					loading={stationLoading}
					disabled={stationLoading}
					onPress={() => void handleStartStation()}
				>
					開始
				</Button>
			</View>

			<TrackSection
				title='最近聴いた曲'
				tracks={recent.data ?? []}
			/>
			<TrackSection
				title='よく聴いている曲'
				tracks={frequentTracks}
			/>
			<TrackSection
				title={recommendations.data?.seeded ? 'あなたへのおすすめ' : 'おすすめの音楽'}
				tracks={recommendedTracks ?? []}
				loading={recommendations.isPending}
				onRefresh={refreshRecommendations}
			/>
			<TrackSection
				title='人気の音楽'
				tracks={popularTracks}
				loading={popular.isPending}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	stationCard: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 16,
		padding: 16,
		marginTop: 8,
		gap: 12,
	},
	stationText: { flex: 1, gap: 2 },
	section: { marginTop: 16 },
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	sectionTitle: { fontWeight: 'bold' },
	cardRow: { gap: 12 },
	card: { width: CARD_SIZE, borderRadius: 12 },
	cardTitle: { marginTop: 6 },
	cardSubtitle: { opacity: 0.7 },
	loading: { height: CARD_SIZE },
})
