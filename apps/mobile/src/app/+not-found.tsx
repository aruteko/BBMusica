import { useRouter } from 'expo-router'
import { Button, StyleSheet, Text, View } from 'react-native'
import { t } from '@/i18n'

const NotFoundScreen: React.FC = () => {
	const router = useRouter()
	const handleGoHome = () => {
		router.replace('/(tabs)')
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>404</Text>
			<Text style={styles.message}>{t('お探しのページが見つかりません')}</Text>
			<Button
				title={t('ホームに戻る')}
				onPress={handleGoHome}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
		backgroundColor: '#f5f5f5', // A light grey background
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#333', // Darker text for title
		marginBottom: 8,
	},
	message: {
		fontSize: 16,
		color: '#666', // Slightly lighter text for message
		textAlign: 'center',
		marginBottom: 20,
	},
})

export default NotFoundScreen
