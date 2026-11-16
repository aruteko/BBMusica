import { memo } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Text } from 'react-native-paper'

import { CORNER_RADIUS } from '@/theme/dimensions'

/** ライブラリの一覧は、2列のグリッドで表示する */
export const GRID_COLUMNS = 2
/** 一覧の左右の余白（一覧の外側） */
const LIST_HORIZONTAL_MARGIN = 16
/** カード1枚の内側の余白 */
const CARD_PADDING = 6

/** グリッドのカバー画像1枚の大きさ */
export function useGridCoverSize(): number {
	const { width } = useWindowDimensions()
	return (
		Math.floor((width - LIST_HORIZONTAL_MARGIN * 2) / GRID_COLUMNS) -
		CARD_PADDING * 2
	)
}

interface GridCardProps {
	title: string
	subtitle?: ReactNode
	renderCover: (size: number) => ReactNode
	onPress: () => void
	disabled?: boolean
	testID?: string
}

/** カバー画像を大きく出し、その下にタイトルと補足を並べるカード */
const GridCard = memo(function GridCard({
	title,
	subtitle,
	renderCover,
	onPress,
	disabled,
	testID,
}: GridCardProps) {
	const size = useGridCoverSize()
	return (
		<Touchable
			androidRipple={{}}
			disabled={disabled}
			onPress={onPress}
			style={[styles.card, disabled && styles.disabled]}
			testID={testID}
		>
			<View>
				{renderCover(size)}
				<Text
					variant='titleSmall'
					numberOfLines={2}
					style={styles.title}
				>
					{title}
				</Text>
				{typeof subtitle === 'string' ? (
					<Text
						variant='bodySmall'
						numberOfLines={1}
						style={styles.subtitle}
					>
						{subtitle}
					</Text>
				) : (
					subtitle
				)}
			</View>
		</Touchable>
	)
})

const styles = StyleSheet.create({
	card: {
		flex: 1,
		padding: CARD_PADDING,
		borderRadius: CORNER_RADIUS,
		overflow: 'hidden',
	},
	disabled: { opacity: 0.5 },
	// 1行のタイトルでも2行分の高さを確保して、横に並ぶカードの高さをそろえる
	title: { marginTop: 8, minHeight: 40 },
	subtitle: { opacity: 0.7 },
})

export default GridCard
