import { memo, useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import UniversalCheckbox from '@/components/common/UniversalCheckbox'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { t } from '@/i18n'

const SyncOptionsModal = memo(function SyncOptionsModal({
	favoriteId,
	shouldRedirectToLocalPlaylist,
}: {
	favoriteId: number
	shouldRedirectToLocalPlaylist?: boolean
}) {
	const colors = useTheme().colors
	const close = useModalStore((state) => state.close)
	const open = useModalStore((state) => state.open)
	const setSettings = useAppStore((state) => state.setSettings)
	const defaultExpandMultiPage = useAppStore(
		(state) => state.settings.expandMultiPageOnSync,
	)
	const [expandMultiPage, setExpandMultiPage] = useState(
		defaultExpandMultiPage ?? false,
	)

	const handleStart = useCallback(() => {
		setSettings({ expandMultiPageOnSync: expandMultiPage })
		close('SyncOptions')
		open(
			'PlaylistSyncProgress',
			{
				remoteId: favoriteId,
				type: 'favorite',
				shouldRedirectToLocalPlaylist,
				expandMultiPage,
			},
			{ dismissible: false },
		)
	}, [
		close,
		expandMultiPage,
		favoriteId,
		open,
		setSettings,
		shouldRedirectToLocalPlaylist,
	])

	return (
		<>
			<Dialog.Title>{t('お気に入りを同期')}</Dialog.Title>
			<Dialog.Content>
				<View style={styles.checkboxRow}>
					<UniversalCheckbox
						status={expandMultiPage ? 'checked' : 'unchecked'}
						onPress={() => setExpandMultiPage((v) => !v)}
					/>
					<Text variant='bodyLarge'>{t('分割P動画を展開')}</Text>
				</View>
				<Text
					variant='bodySmall'
					style={[styles.hint, { color: colors.onSurfaceVariant }]}
				>{t('分割P動画を、各Pごとの曲として同期します')}</Text>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('SyncOptions')}>{t('キャンセル')}</Button>
				<Button
					mode='contained'
					onPress={handleStart}
				>{t('同期を開始')}</Button>
			</Dialog.Actions>
		</>
	)
})

SyncOptionsModal.displayName = 'SyncOptionsModal'

const styles = StyleSheet.create({
	checkboxRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	hint: {
		marginTop: 12,
		lineHeight: 18,
	},
})

export default SyncOptionsModal
