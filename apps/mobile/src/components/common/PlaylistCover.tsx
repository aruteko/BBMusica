import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { memo, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'

interface PlaylistCoverProps {
	id: string | number
	title: string
	/** 明确指定的封面。存在时直接显示，不拼贴 */
	cover?: string | null | undefined | ImageRef
	/** 未指定 cover 时用于拼贴的曲目封面（最多使用 4 张） */
	previewCovers?: string[]
	size: number
	borderRadius?: number
	style?: StyleProp<ViewStyle>
}

/**
 * 播放列表封面。
 * - 指定了封面：显示该封面
 * - 未指定封面且有曲目封面：把最多 4 张曲目封面拼成 2×2（不足 4 张时重复填充）
 * - 其他情况：退回到渐变占位符
 */
const PlaylistCover = memo(function PlaylistCover({
	id,
	title,
	cover,
	previewCovers,
	size,
	borderRadius,
	style,
}: PlaylistCoverProps) {
	const tiles = useMemo(() => {
		const unique = Array.from(new Set(previewCovers ?? [])).slice(0, 4)
		if (unique.length === 0) return []
		// 1 张：整张显示；2/3 张：循环补齐到 4 格，避免出现空白格
		if (unique.length === 1) return [{ key: 'single', uri: unique[0] }]
		return Array.from({ length: 4 }, (_, i) => ({
			key: `tile-${i}`,
			uri: unique[i % unique.length],
		}))
	}, [previewCovers])

	if (cover || tiles.length === 0) {
		return (
			<CoverWithPlaceHolder
				id={id}
				cover={cover}
				title={title}
				size={size}
				borderRadius={borderRadius}
				style={style}
			/>
		)
	}

	if (tiles.length === 1) {
		return (
			<CoverWithPlaceHolder
				id={id}
				cover={tiles[0].uri}
				title={title}
				size={size}
				borderRadius={borderRadius}
				style={style}
			/>
		)
	}

	const radius = borderRadius ?? size * 0.22
	const half = size / 2
	return (
		<SquircleView
			style={[
				styles.container,
				{ width: size, height: size, borderRadius: radius },
				style,
			]}
			cornerSmoothing={0.6}
		>
			<View style={styles.grid}>
				{tiles.map(({ key, uri }) => (
					<Image
						key={key}
						source={{ uri: resolveBilibiliImageUrl(uri, 200) ?? uri }}
						recyclingKey={`${id}-${key}`}
						style={{ width: half, height: half }}
						contentFit='cover'
						transition={0}
						cachePolicy={uri.startsWith('file://') ? 'none' : 'disk'}
					/>
				))}
			</View>
		</SquircleView>
	)
})

const styles = StyleSheet.create({
	container: {
		overflow: 'hidden',
	},
	grid: {
		flex: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
})

PlaylistCover.displayName = 'PlaylistCover'

export default PlaylistCover
