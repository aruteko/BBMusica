import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { memo, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet } from 'react-native'
import SquircleView from 'react-native-fast-squircle'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import { CORNER_RADIUS } from '@/theme/dimensions'

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
 * - 未指定封面且有曲目封面：按张数拼贴。1 张整张、2 张左右分割、
 *   3 张左边 1 张大图 + 右边上下 2 张、4 张以上 2×2
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
		return unique.map((uri, i) => ({ key: `tile-${i}`, uri }))
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

	const radius = borderRadius ?? CORNER_RADIUS
	const half = size / 2
	// 各タイルの位置と大きさ（2 枚は左右、3 枚は左を大きく、4 枚は 2×2）
	const frames =
		tiles.length === 2
			? [
					{ left: 0, top: 0, width: half, height: size },
					{ left: half, top: 0, width: half, height: size },
				]
			: tiles.length === 3
				? [
						{ left: 0, top: 0, width: half, height: size },
						{ left: half, top: 0, width: half, height: half },
						{ left: half, top: half, width: half, height: half },
					]
				: [
						{ left: 0, top: 0, width: half, height: half },
						{ left: half, top: 0, width: half, height: half },
						{ left: 0, top: half, width: half, height: half },
						{ left: half, top: half, width: half, height: half },
					]
	return (
		<SquircleView
			style={[
				styles.container,
				{ width: size, height: size, borderRadius: radius },
				style,
			]}
			cornerSmoothing={0.6}
		>
			{tiles.map(({ key, uri }, i) => (
				<Image
					key={key}
					source={{ uri: resolveBilibiliImageUrl(uri, 200) ?? uri }}
					recyclingKey={`${id}-${key}`}
					style={[styles.tile, frames[i]]}
					contentFit='cover'
					transition={0}
					cachePolicy={uri.startsWith('file://') ? 'none' : 'disk'}
				/>
			))}
		</SquircleView>
	)
})

const styles = StyleSheet.create({
	container: {
		overflow: 'hidden',
	},
	tile: {
		position: 'absolute',
	},
})

PlaylistCover.displayName = 'PlaylistCover'

export default PlaylistCover
