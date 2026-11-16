import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import Animated from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import IconButton from '@/components/common/IconButton'
import { usePlayerHeaderAnimation } from '@/features/player/hooks/usePlayerHeaderAnimation'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { t } from '@/i18n'

export function PlayerHeader({
	onMorePress,
	onBack,
	index,
	mainIndex = 0,
	scrollX,
}: {
	onMorePress: () => void
	onBack: () => void
	index: number
	/** メインページの位置（音楽モードは 1、ポッドキャストモードは 0） */
	mainIndex?: number
	scrollX?: SharedValue<number>
}) {
	const currentTrack = useCurrentTrack()
	const title = currentTrack?.title ?? t('再生中')
	const statusText = t('再生中')

	const { titleStyle, statusStyle } = usePlayerHeaderAnimation(
		index,
		scrollX,
		mainIndex,
	)

	return (
		<View style={styles.container}>
			{
				<IconButton
					icon={index === mainIndex ? 'chevron-down' : 'chevron-left'}
					size={24}
					onPress={onBack}
				/>
			}
			<View style={styles.titleContainer}>
				<Animated.View
					style={[styles.headerTextContainer, statusStyle]}
					pointerEvents='none'
				>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={styles.text}
					>
						{statusText}
					</Text>
				</Animated.View>
				<Animated.View
					style={[styles.headerTextContainer, titleStyle]}
					pointerEvents='none'
				>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={styles.text}
					>
						{title}
					</Text>
				</Animated.View>
			</View>
			<IconButton
				icon='dots-vertical'
				size={24}
				onPress={onMorePress}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	titleContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		height: 40,
	},
	headerTextContainer: {
		...StyleSheet.absoluteFill,
		justifyContent: 'center',
		alignItems: 'center',
	},
	text: {
		textAlign: 'center',
	},
})
