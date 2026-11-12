import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

export const GITHUB_REPO_URL = 'https://github.com/bbplayer-app/BBPlayer'

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
			toast.error('ブラウザを開けないため、リンクをクリップボードにコピーしました', {
				description: String(e),
			})
		}
		close('StarPrompt')
	}

	return (
		<>
			<Dialog.Title>BBPlayerを気に入っていただけましたか？</Dialog.Title>
			<Dialog.Content>
				<Text variant='bodyMedium'>
					気に入っていただけたら、GitHubでStarを付けて応援してください 🥺
				</Text>
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				<Button onPress={handleDontShowAgain}>今後表示しない</Button>
				<View style={styles.rightActionsContainer}>
					<Button onPress={handleClose}>キャンセル</Button>
					<Button onPress={() => void handleGoStar()}>Starを付ける</Button>
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
