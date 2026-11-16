import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { Chip, IconButton, Text, useTheme } from 'react-native-paper'
import { t } from '@/i18n'

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
}

export default function SearchHistory({
	searchHistory,
	onHistoryPress,
	onClearHistory,
	onRemoveHistoryItem,
}: SearchHistoryProps) {
	const { colors } = useTheme()
	return (
		<ScrollView
			style={styles.historySection}
			keyboardShouldPersistTaps='handled'
		>
			<View style={styles.historyHeader}>
				<Text
					variant='titleMedium'
					style={styles.historyTitle}
				>{t('最近の検索')}</Text>
				{searchHistory && searchHistory.length > 0 && onClearHistory && (
					<IconButton
						icon='trash-can-outline'
						accessibilityLabel={t('検索履歴を消去')}
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
					>{t('検索履歴はありません')}</Text>
				)}
			</View>
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
		// 左右が半円の、長円形
		borderRadius: 9999,
	},
	noHistoryText: { paddingVertical: 16, textAlign: 'center' },
})
