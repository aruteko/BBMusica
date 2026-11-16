import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { useEditPlaylistMetadata } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { bilibiliFacade } from '@/lib/facades/bilibili'
import type { Playlist } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import toast from '@/utils/toast'
import { t } from '@/i18n'

const logger = log.extend('Components.EditPlaylistMetadataModal')

export default function EditPlaylistMetadataModal({
	playlist,
}: {
	playlist: Playlist
}) {
	const { mutate: editPlaylistMetadata } = useEditPlaylistMetadata()
	const [title, setTitle] = useState(playlist.title)
	const [description, setDescription] = useState(playlist.description)
	const [coverUrl, setCoverUrl] = useState(playlist.coverUrl)
	const modalClose = useModalStore((state) => state.close)
	const close = useCallback(
		() => modalClose('EditPlaylistMetadata'),
		[modalClose],
	)

	const fetchRemoteMetadata = useCallback(async () => {
		if (!playlist.remoteSyncId) {
			toast.error(t('リモートのデータを取得できません'))
			return
		}
		const result = await bilibiliFacade.fetchRemotePlaylistMetadata(
			playlist.remoteSyncId,
			playlist.type,
		)
		if (result.isErr()) {
			toastAndLogError(
				t('リモートのプレイリスト情報の取得に失敗しました'),
				result.error,
				'Components.EditPlaylistMetadataModal',
			)
			return
		}
		const metadata = result.value
		setTitle(metadata.title)
		setDescription(metadata.description)
		setCoverUrl(metadata.coverUrl)
		logger.debug('获取远程播放列表元数据成功', metadata)
		toast.success(t('リモートのプレイリスト情報を取得しました'))
	}, [playlist.remoteSyncId, playlist.type])

	const handleConfirm = useCallback(() => {
		if (title.trim().length === 0) {
			toast.error(t('タイトルを入力してください'))
			return
		}
		editPlaylistMetadata({
			playlistId: playlist.id,
			payload: {
				title,
				description: description ?? undefined,
				coverUrl: coverUrl ?? undefined,
			},
		})
		close()
	}, [close, coverUrl, description, editPlaylistMetadata, playlist.id, title])

	const handleImagePicker = useCallback(async () => {
		const result = await DocumentPicker.getDocumentAsync({
			type: 'image/*',
			copyToCacheDirectory: true,
			multiple: false,
		})
		if (result.canceled || result.assets.length === 0) return
		const assetFile = new FileSystem.File(result.assets[0].uri)
		const coverDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'covers',
		)
		if (!coverDir.exists) {
			coverDir.create({ intermediates: true })
		}
		const coverFile = new FileSystem.File(coverDir, assetFile.name)
		if (coverFile.exists) {
			coverFile.delete()
		}
		await assetFile.copy(coverFile)
		setCoverUrl(coverFile.uri)
	}, [])

	const handleDismiss = useCallback(() => {
		close()
		setTitle('')
		setDescription('')
		setCoverUrl('')
	}, [close])

	return (
		<>
			<Dialog.Title>{t('情報を編集')}</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<TextInput
					label={t('タイトル')}
					testID='edit-playlist-title-input'
					value={title}
					onChangeText={setTitle}
					mode='outlined'
					numberOfLines={1}
					textAlignVertical='top'
				/>
				<TextInput
					label={t('説明')}
					onChangeText={setDescription}
					value={description ?? undefined}
					mode='outlined'
					multiline
					style={styles.descriptionInput}
					textAlignVertical='top'
				/>
				<View style={styles.coverUrlContainer}>
					<TextInput
						label={t('カバー')}
						onChangeText={setCoverUrl}
						value={coverUrl ?? undefined}
						mode='outlined'
						numberOfLines={1}
						textAlignVertical='top'
						style={styles.coverUrlInput}
					/>
					<IconButton
						icon='image-plus'
						size={20}
						style={styles.imagePickerButton}
						onPress={handleImagePicker}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				{playlist.type !== 'local' && playlist.type !== 'dynamic' ? (
					<Button onPress={fetchRemoteMetadata}>{t('リモートのデータを取得')}</Button>
				) : (
					<View />
				)}
				<View style={styles.rightActionsContainer}>
					<Button onPress={handleDismiss}>{t('キャンセル')}</Button>
					<Button
						testID='edit-playlist-confirm-button'
						onPress={handleConfirm}
					>
						OK
					</Button>
				</View>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 5,
	},
	descriptionInput: {
		maxHeight: 150,
	},
	coverUrlContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	coverUrlInput: {
		flex: 1,
	},
	imagePickerButton: {
		marginTop: 13,
	},
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
})
