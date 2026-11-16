import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import { playlistFacade } from '@/lib/facades/playlist'
import type { ModalPropsMap } from '@/types/navigation'
import { toastAndLogError } from '@/utils/error-handling'
import Log from '@/utils/log'
import toast from '@/utils/toast'
import { t } from '@/i18n'

const logger = Log.extend('SaveQueueToPlaylistModal')

export default function SaveQueueToPlaylistModal({
	trackIds,
}: ModalPropsMap['SaveQueueToPlaylist']) {
	const [name, setName] = useState('')
	const [loading, setLoading] = useState(false)
	const close = useModalStore((state) => state.close)

	const handleSave = async () => {
		if (!name.trim()) return
		setLoading(true)

		const res = await playlistFacade.saveQueueAsPlaylist(name, trackIds)

		if (res.isErr()) {
			toastAndLogError(
				t('プレイリストの保存に失敗しました'),
				res.error,
				'SaveQueueToPlaylistModal',
			)
			setLoading(false)
			return
		}

		logger.info('キューをプレイリストに保存しました', res.value)
		toast.success(t('キューをプレイリストに保存しました'))
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			}),
			queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistContents(res.value),
			}),
			queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistMetadata(res.value),
			}),
		])
		setLoading(false)
		close('SaveQueueToPlaylist')
	}

	return (
		<>
			<Dialog.Title>{t('キューをプレイリストに保存')}</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label={t('プレイリスト名')}
					value={name}
					onChangeText={setName}
					mode='outlined'
					style={styles.textInput}
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('SaveQueueToPlaylist')}
					disabled={loading}
				>{t('キャンセル')}</Button>
				<Button
					onPress={handleSave}
					loading={loading}
					disabled={loading}
				>
					保存
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	textInput: {
		backgroundColor: 'transparent',
	},
})
