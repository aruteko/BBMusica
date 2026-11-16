import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { t } from '@/i18n'

export default function TabDisable() {
	const { colors } = useTheme()
	const router = useRouter()

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Text
				variant='titleMedium'
				style={styles.text}
			>{t('bilibiliアカウントにログインするとコレクションを確認できます')}</Text>
			<Button
				mode='contained'
				onPress={() =>
					router.navigate('/settings/bilibili-account/qrcode-login')
				}
			>{t('ログイン')}</Button>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
	},
	text: {
		textAlign: 'center',
	},
})
