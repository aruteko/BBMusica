import Color from 'color'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { IconButton, Text, useTheme } from 'react-native-paper'

import { t } from '@/i18n'
import type { Track } from '@/types/core/media'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'

/** 画像の高さ。画面の幅に対する比 */
const HERO_ASPECT = 0.85

/** 画面の端まで広げるために、親の左右の余白を打ち消す */
const PARENT_HORIZONTAL_PADDING = 16

interface StationHeroProps {
	track: Track
	loading: boolean
	onStart: (track: Track) => void
}

/**
 * ステーションの先頭の曲を、画面の幅いっぱいに大きく出す。
 * 画像の上下左右は、背景の色に溶け込むよう、グラデーションで覆う。
 * 曲の画像から色を取り出すのではなく、背景の色をそのまま重ねる。
 */
const StationHero = memo(function StationHero({
	track,
	loading,
	onStart,
}: StationHeroProps) {
	const { colors } = useTheme()
	const { width } = useWindowDimensions()
	const height = Math.round(width * HERO_ASPECT)

	const solid = colors.background
	// 「透明」は背景と同じ色の透明にする（黒の透明だと、途中で灰色が混ざる）
	const clear = Color(solid).alpha(0).rgb().string()
	const uri = track.coverUrl
		? (resolveBilibiliImageUrl(track.coverUrl, 1000) ?? track.coverUrl)
		: undefined
	const sideWidth = width * 0.12

	return (
		<Pressable
			style={[styles.hero, { height, backgroundColor: solid }]}
			onPress={() => onStart(track)}
			disabled={loading}
			accessibilityRole='button'
			accessibilityLabel={`${track.title}${t(' を再生')}`}
		>
			{uri ? (
				<Image
					source={{ uri }}
					recyclingKey={track.uniqueKey}
					style={StyleSheet.absoluteFill}
					contentFit='cover'
					transition={200}
				/>
			) : null}
			{/* 上 */}
			<LinearGradient
				pointerEvents='none'
				colors={[solid, clear]}
				style={[styles.fade, { top: 0, left: 0, right: 0, height: height * 0.3 }]}
			/>
			{/* 左 */}
			<LinearGradient
				pointerEvents='none'
				colors={[solid, clear]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.fade, { top: 0, bottom: 0, left: 0, width: sideWidth }]}
			/>
			{/* 右 */}
			<LinearGradient
				pointerEvents='none'
				colors={[clear, solid]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.fade, { top: 0, bottom: 0, right: 0, width: sideWidth }]}
			/>
			{/* 下（文字を読みやすくするため、広めに覆う） */}
			<LinearGradient
				pointerEvents='none'
				colors={[clear, solid]}
				style={[styles.fade, { bottom: 0, left: 0, right: 0, height: height * 0.55 }]}
			/>
			<View style={styles.body}>
				<View style={styles.text}>
					<Text
						variant='labelMedium'
						style={{ color: colors.primary }}
					>
						{t('ステーション')}
					</Text>
					<Text
						variant='headlineMedium'
						numberOfLines={2}
						style={[styles.title, { color: colors.onSurface }]}
					>
						{track.title}
					</Text>
					{track.artist?.name ? (
						<Text
							variant='bodyMedium'
							numberOfLines={1}
							style={{ color: colors.onSurfaceVariant }}
						>
							{track.artist.name}
						</Text>
					) : null}
				</View>
				<IconButton
					mode='contained'
					icon='play'
					size={28}
					containerColor={colors.primary}
					iconColor={colors.onPrimary}
					loading={loading}
					disabled={loading}
					accessibilityLabel={t('開始')}
					onPress={() => onStart(track)}
				/>
			</View>
		</Pressable>
	)
})

const styles = StyleSheet.create({
	hero: {
		marginHorizontal: -PARENT_HORIZONTAL_PADDING,
		overflow: 'hidden',
	},
	fade: { position: 'absolute' },
	body: {
		position: 'absolute',
		left: PARENT_HORIZONTAL_PADDING,
		right: PARENT_HORIZONTAL_PADDING,
		bottom: 8,
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 12,
	},
	text: { flex: 1, gap: 2, paddingBottom: 8 },
	title: { fontWeight: 'bold' },
})

export default StationHero
