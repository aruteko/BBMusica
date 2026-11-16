import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { parseExternalPlaylistInfo } from '@/lib/utils/playlistUrlParser'
import { t } from '@/i18n'

const InputExternalPlaylistInfoModal = () => {
	const [input, setInput] = useState('')
	const [source, setSource] = useState<'netease' | 'qq'>('netease')
	const router = useRouter()
	const close = useModalStore((state) => state.close)

	const handleConfirm = () => {
		if (!input.trim()) return
		const parsed = parseExternalPlaylistInfo(input)
		const finalId = parsed?.id ?? input.trim()
		const finalSource = parsed?.source ?? source

		close('InputExternalPlaylistInfo')
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.navigate({
				pathname: '/playlist/external-sync',
				params: { id: finalId, source: finalSource },
			})
		})
	}

	return (
		<>
			<Dialog.Title>{t('外部プレイリストの情報を入力')}</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label={t('プレイリストID / リンク')}
					value={input}
					onChangeText={(text) => {
						setInput(text)
						const result = parseExternalPlaylistInfo(text)
						if (result) {
							setSource(result.source)
						}
					}}
					mode='outlined'
					style={styles.input}
				/>
				<View style={styles.segmentedContainer}>
					<Text style={styles.label}>{t('ソース：')}</Text>
					<SegmentedControl
						selectedIndex={source === 'netease' ? 0 : 1}
						onChange={(event) => {
							const selectedIndex = event.nativeEvent.selectedSegmentIndex
							setSource(selectedIndex === 0 ? 'netease' : 'qq')
						}}
						values={['NetEase Cloud Music', t('QQ音楽')]}
						style={styles.segmentedButtons}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('InputExternalPlaylistInfo')}>{t('キャンセル')}</Button>
				<Button
					onPress={handleConfirm}
					disabled={!input.trim()}
				>
					OK
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	input: {
		marginBottom: 16,
	},
	segmentedContainer: {
		marginTop: 8,
	},
	label: {
		marginBottom: 8,
	},
	segmentedButtons: {
		marginTop: 4,
	},
})

export default InputExternalPlaylistInfoModal
