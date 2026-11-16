import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { GITHUB_REPO_URL } from '@/lib/config/links'
import toast from '@/utils/toast'
import { t } from '@/i18n'

export { GITHUB_REPO_URL }

export default function StarPromptModal() {
	const close = useModalStore((state) => state.close)
	const setSettings = useAppStore((state) => state.setSettings)

	const handleClose = () => close('StarPrompt')

	const handleDontShowAgain = () => {
		setSettings({ hideStarPrompt: true })
		close('StarPrompt')
	}

	const handleGoStar = async () => {
		try {
			await WebBrowser.openBrowserAsync(GITHUB_REPO_URL)
		} catch (e) {
			await Clipboard.setStringAsync(GITHUB_REPO_URL)
			toast.error(t('ブラウザを開けないため、リンクをクリップボードにコピーしました'), {
				description: String(e),
			})
		}
		close('StarPrompt')
	}

	return (
		<>
			<Dialog.Title>{t('BBMusicaはいかがですか？')}</Dialog.Title>
			<Dialog.Content>
				<Text variant='bodyMedium'>{t('GitHubでStarを付けて応援してください')}</Text>
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				<Button onPress={handleDontShowAgain}>{t('今後表示しない')}</Button>
				<View style={styles.rightActionsContainer}>
					<Button onPress={handleClose}>{t('キャンセル')}</Button>
					<Button onPress={() => void handleGoStar()}>{t('Starを付ける')}</Button>
				</View>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
	},
})
