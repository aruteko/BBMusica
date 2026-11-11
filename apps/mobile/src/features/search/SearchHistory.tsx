import type { ReactNode } from 'react'
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { Chip, IconButton, Text, useTheme } from 'react-native-paper'

export interface SearchHistoryItem {
	id: string
	text: string
	timestamp: number
}

interface SearchHistoryProps {
	searchHistory?: SearchHistoryItem[]
	onHistoryPress: (query: string) => void
	onClearHistory: () => void
	onRemoveHistoryItem: (id: string) => void
	onDismiss: () => void
	panelVisible: boolean
	/** 显示在搜索历史下方的内容（首页推荐等），与历史一起滚动 */
	footer?: ReactNode
}

export default function SearchHistory({
	searchHistory,
	onHistoryPress,
	onClearHistory,
	onRemoveHistoryItem,
	onDismiss,
	panelVisible,
	footer,
}: SearchHistoryProps) {
	const { colors } = useTheme()
	return (
		<ScrollView
			style={styles.historySection}
			pointerEvents={panelVisible ? 'none' : 'auto'}
			onTouchStart={onDismiss}
			keyboardShouldPersistTaps='handled'
		>
			<View style={styles.historyHeader}>
				<Text
					variant='titleMedium'
					style={styles.historyTitle}
				>
					最近の検索
				</Text>
				{searchHistory && searchHistory.length > 0 && onClearHistory && (
					<IconButton
						icon='trash-can-outline'
						accessibilityLabel='検索履歴を消去'
						size={20}
						onPress={onClearHistory}
					/>
				)}
			</View>
			<View style={styles.historyChipsContainer}>
				{searchHistory && searchHistory.length > 0 ? (
					searchHistory.map((item) => (
						<Chip
							key={item.id}
							onPress={() => {
								Keyboard.dismiss()
								onHistoryPress(item.text)
							}}
							onLongPress={() => onRemoveHistoryItem?.(item.id)}
							style={styles.chip}
							mode='outlined'
						>
							{item.text}
						</Chip>
					))
				) : (
					<Text
						style={[styles.noHistoryText, { color: colors.onSurfaceVariant }]}
					>
						検索履歴はありません
					</Text>
				)}
			</View>
			{footer}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	historySection: {
		flex: 1,
		paddingTop: 8,
	},
	historyHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	historyTitle: {
		fontWeight: 'bold',
	},
	historyChipsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	chip: {
		marginRight: 8,
		marginBottom: 8,
	},
	noHistoryText: { paddingVertical: 16, textAlign: 'center' },
})
