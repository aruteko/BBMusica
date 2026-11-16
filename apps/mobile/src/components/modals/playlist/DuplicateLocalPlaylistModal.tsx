import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useDuplicatePlaylist } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { t } from '@/i18n'

export default function DuplicateLocalPlaylistModal({
	sourcePlaylistId,
	rawName,
}: {
	sourcePlaylistId: number
	rawName: string
}) {
	const [duplicatePlaylistName, setDuplicatePlaylistName] = useState(
		`${rawName}${t('-コピー')}`,
	)
	const { mutate: duplicatePlaylist } = useDuplicatePlaylist()
	const close = useModalStore((state) => state.close)
	const closeAll = useModalStore((state) => state.closeAll)
	const router = useRouter()

	const handleDuplicatePlaylist = useCallback(() => {
		if (!duplicatePlaylistName) return
		duplicatePlaylist(
			{
				playlistId: sourcePlaylistId,
				name: duplicatePlaylistName,
			},
			{
				onSuccess: (id) => {
					closeAll()
					useModalStore.getState().doAfterModalHostClosed(() => {
						router.navigate({
							pathname: '/playlist/local/[id]',
							params: { id: String(id) },
						})
					})
				},
			},
		)
	}, [
		duplicatePlaylistName,
		duplicatePlaylist,
		sourcePlaylistId,
		closeAll,
		router,
	])

	return (
		<>
			<Dialog.Title>{t('プレイリストを複製')}</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label={t('新しいプレイリスト名')}
					value={duplicatePlaylistName}
					onChangeText={setDuplicatePlaylistName}
					mode='outlined'
					numberOfLines={1}
					style={styles.textInput}
					textAlignVertical='top'
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('DuplicateLocalPlaylist')}>{t('キャンセル')}</Button>
				<Button onPress={handleDuplicatePlaylist}>OK</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	textInput: {
		maxHeight: 200,
	},
})
