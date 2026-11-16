import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { t } from '@/i18n'

interface DataFetchingErrorProps {
	text?: string
	onRetry?: () => void
}

export function DataFetchingError({
	text = t('読み込みに失敗しました'),
	onRetry,
}: DataFetchingErrorProps) {
	const { colors } = useTheme()
	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Text
				variant='titleMedium'
				style={styles.text}
			>
				{text}
			</Text>
			{onRetry && (
				<Button
					onPress={onRetry}
					mode='contained'
				>{t('再試行')}</Button>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	text: {
		textAlign: 'center',
		marginBottom: 16,
	},
})
