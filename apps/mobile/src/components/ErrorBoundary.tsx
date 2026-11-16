import { StyleSheet, Text, View } from 'react-native'
import { Button } from 'react-native-paper'

import { flatErrorMessage } from '@/utils/log'
import { t } from '@/i18n'

export default function GlobalErrorFallback({
	error,
	resetError,
}: {
	error: unknown
	resetError: () => void
}) {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('予期しないエラーが発生しました')}</Text>
			<Text style={styles.message}>
				{error instanceof Error ? flatErrorMessage(error) : String(error)}
			</Text>
			<Button
				mode='contained'
				labelStyle={styles.buttonLabel}
				onPress={resetError}
			>{t('再試行')}</Button>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
	},
	title: {
		marginBottom: 8,
		fontWeight: 'bold',
		fontSize: 20,
	},
	message: {
		marginBottom: 20,
		textAlign: 'center',
	},
	buttonLabel: {
		fontWeight: 'bold',
	},
})
